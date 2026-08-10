'use client';

import {
  LOCATION_SUGGEST_MIN_CHARS,
  resolveGooglePlaceSuggestion,
  searchGooglePlaceSuggestions,
} from '@/lib/location/placesAutocomplete';
import type { LocationSuggestion } from '@/lib/location/types';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
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
  placeholder = 'Search city or area in Nigeria',
  className,
}: Props) {
  const listboxId = useId();
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestSeqRef = useRef(0);
  const suppressSearchRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const trimmedLen = value.trim().length;
  const canSearch = trimmedLen >= LOCATION_SUGGEST_MIN_CHARS;

  const syncDropdownPosition = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 6,
      left: rect.left,
      width: Math.max(rect.width, 240),
      zIndex: 99999,
    });
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      if (suppressSearchRef.current) return;

      const trimmed = q.trim();
      if (trimmed.length < LOCATION_SUGGEST_MIN_CHARS) {
        setSuggestions([]);
        setSearched(false);
        setOpen(false);
        setLoading(false);
        return;
      }

      const requestId = ++requestSeqRef.current;
      setLoading(true);
      setOpen(true);
      syncDropdownPosition();

      try {
        const rows = await searchGooglePlaceSuggestions(trimmed, 8);
        if (requestId !== requestSeqRef.current || suppressSearchRef.current) return;

        setSuggestions(rows);
        setSearched(true);
        setOpen(true);
        syncDropdownPosition();
      } catch {
        if (requestId !== requestSeqRef.current || suppressSearchRef.current) return;
        setSuggestions([]);
        setSearched(true);
        setOpen(true);
      } finally {
        if (requestId === requestSeqRef.current) {
          setLoading(false);
        }
      }
    },
    [syncDropdownPosition]
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (suppressSearchRef.current) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void runSearch(value);
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, runSearch]);

  useEffect(() => {
    if (!open) return;
    syncDropdownPosition();
    const onScrollOrResize = () => syncDropdownPosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, suggestions.length, loading, syncDropdownPosition]);

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
    suppressSearchRef.current = true;
    requestSeqRef.current += 1;
    setOpen(false);
    setSearched(false);
    setSuggestions([]);
    setLoading(false);
    setResolveError(null);

    try {
      const resolved = await resolveGooglePlaceSuggestion(s);
      if (onSelect) {
        onSelect(resolved);
      } else {
        onChange(resolved.label);
      }
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : 'Could not use that location.');
    } finally {
      window.setTimeout(() => {
        suppressSearchRef.current = false;
      }, 400);
    }
  }

  const showPanel = open && canSearch && (loading || searched);
  const showTypeMoreHint = trimmedLen > 0 && trimmedLen < LOCATION_SUGGEST_MIN_CHARS;
  const showNoResults = !loading && searched && canSearch && suggestions.length === 0;

  const dropdown = showPanel ? (
    <ul
      ref={listRef}
      id={listboxId}
      style={dropdownStyle}
      className="max-h-60 overflow-auto rounded-2xl border border-border bg-white py-1 shadow-xl ring-1 ring-black/5"
      role="listbox"
      aria-label="Location suggestions"
    >
      {loading ? (
        <li className="px-4 py-3 text-[13px] font-semibold text-muted" role="presentation">
          Searching…
        </li>
      ) : null}
      {!loading && suggestions.length === 0 ? (
        <li className="px-4 py-3 text-[13px] font-semibold text-muted" role="presentation">
          No places found. Try a city or neighborhood name.
        </li>
      ) : null}
      {!loading
        ? suggestions.map((s) => (
            <li key={`${s.placeId ?? 'place'}-${s.label}`} role="option">
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
          ))
        : null}
    </ul>
  ) : null;

  return (
    <div className={cn('relative block w-full', className)}>
      <label className="block">
        <span className="mb-1.5 block text-[13px] font-bold text-foreground">{label}</span>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => {
            suppressSearchRef.current = false;
            setResolveError(null);
            onChange(e.target.value);
            if (e.target.value.trim().length >= LOCATION_SUGGEST_MIN_CHARS) {
              setOpen(true);
              syncDropdownPosition();
            }
          }}
          onFocus={() => {
            if (suppressSearchRef.current) return;
            if (canSearch) {
              setOpen(true);
              syncDropdownPosition();
              if (!searched && !loading) {
                void runSearch(value);
              }
            }
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls={showPanel ? listboxId : undefined}
          className="w-full rounded-2xl border border-border bg-[#F8F9FC] px-4 py-3.5 text-[15px] font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
        />
      </label>
      <div className="mt-1.5 min-h-[1.125rem]">
        {resolveError ? (
          <p className="text-[12px] font-semibold text-red-600">{resolveError}</p>
        ) : showTypeMoreHint ? (
          <p className="text-[12px] font-semibold text-muted">
            Type at least {LOCATION_SUGGEST_MIN_CHARS} characters to see places.
          </p>
        ) : showNoResults && !showPanel ? (
          <p className="text-[12px] font-semibold text-muted">
            No places found. Try a city, neighborhood, or landmark.
          </p>
        ) : null}
      </div>
      {mounted && dropdown ? createPortal(dropdown, document.body) : null}
    </div>
  );
}
