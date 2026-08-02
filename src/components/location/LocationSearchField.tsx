'use client';

import {
  LOCATION_SUGGEST_MIN_CHARS,
  resolveGooglePlaceSuggestion,
  searchGooglePlaceSuggestions,
} from '@/lib/location/placesAutocomplete';
import { loadGooglePlacesLibrary } from '@/lib/location/googlePlacesClient';
import type { LocationSuggestion } from '@/lib/location/types';
import { isGoogleMapsConfigured } from '@/lib/maps/config';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  label?: string;
  value: string;
  onChange: (label: string) => void;
  onSelect?: (suggestion: LocationSuggestion) => void;
  placeholder?: string;
  className?: string;
};

export function LocationSearchField({
  label = 'Location',
  value,
  onChange,
  onSelect,
  placeholder = 'Search for a place…',
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const mapsReady = isGoogleMapsConfigured();

  const updateDropdownPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 10000,
    });
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      const trimmed = q.trim();
      if (trimmed.length < LOCATION_SUGGEST_MIN_CHARS) {
        setSuggestions([]);
        setOpen(false);
        setSearched(false);
        return;
      }

      setLoading(true);
      try {
        const rows = await searchGooglePlaceSuggestions(q, 8);
        setSuggestions(rows);
        setSearched(true);
        setOpen(rows.length > 0);
        if (rows.length > 0) updateDropdownPosition();
      } finally {
        setLoading(false);
      }
    },
    [updateDropdownPosition]
  );

  useEffect(() => {
    setMounted(true);
    if (mapsReady) void loadGooglePlacesLibrary();
  }, [mapsReady]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void runSearch(value), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runSearch]);

  useEffect(() => {
    if (!open) return;
    updateDropdownPosition();
    const onScrollOrResize = () => updateDropdownPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, suggestions.length, updateDropdownPosition]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (inputRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  async function pick(s: LocationSuggestion) {
    setOpen(false);
    setSearched(false);
    const resolved = await resolveGooglePlaceSuggestion(s);
    onChange(resolved.label);
    onSelect?.(resolved);
  }

  const trimmedLen = value.trim().length;
  const showTypeMoreHint =
    trimmedLen > 0 && trimmedLen < LOCATION_SUGGEST_MIN_CHARS;
  const showNoResults =
    !loading && searched && trimmedLen >= LOCATION_SUGGEST_MIN_CHARS && suggestions.length === 0;

  const dropdown =
    open && suggestions.length > 0 ? (
      <ul
        ref={listRef}
        style={dropdownStyle}
        className="max-h-56 overflow-auto rounded-2xl border border-border bg-white py-1 shadow-lg"
        role="listbox"
        aria-label="Location suggestions"
      >
        {suggestions.map((s) => (
          <li key={s.placeId ?? s.label} role="option">
            <button
              type="button"
              className="w-full px-4 py-2.5 text-left text-[14px] font-semibold text-foreground hover:bg-[#F8F7FF]"
              onMouseDown={(e) => {
                e.preventDefault();
                void pick(s);
              }}
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    ) : null;

  return (
    <div className={cn('relative block w-full', className)}>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-bold text-foreground">{label}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) {
              updateDropdownPosition();
              setOpen(true);
            } else if (trimmedLen >= LOCATION_SUGGEST_MIN_CHARS) {
              void runSearch(value);
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={open && suggestions.length > 0}
          className="w-full rounded-2xl border border-border bg-[#F8F9FC] px-4 py-3.5 text-[15px] font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      {loading ? (
        <span className="pointer-events-none absolute right-4 top-[2.85rem] text-[12px] font-semibold text-muted">
          Searching…
        </span>
      ) : null}
      {showTypeMoreHint ? (
        <p className="mt-1.5 text-[12px] font-semibold text-muted">
          Type at least {LOCATION_SUGGEST_MIN_CHARS} characters to see places.
        </p>
      ) : null}
      {showNoResults ? (
        <p className="mt-1.5 text-[12px] font-semibold text-muted">
          No places found. Try a city, neighborhood, or landmark.
        </p>
      ) : null}
      {!mapsReady ? (
        <span className="mt-1.5 block text-[12px] font-semibold text-muted">
          Location search uses OpenStreetMap. Add{' '}
          <code className="text-primary">NEXT_PUBLIC_GOOGLE_MAPS_WEB_API_KEY</code> for Google Places
          when available.
        </span>
      ) : null}
      {mounted && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
