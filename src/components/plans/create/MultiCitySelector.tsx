'use client';

import {
  MULTI_CITY_MAX,
  MULTI_CITY_MIN,
  filterNigerianCities,
  getNigerianCityLabel,
} from '@/lib/plans/nigerianCities';
import { cn } from '@/utils/cn';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoClose, IoSearchOutline } from 'react-icons/io5';

type Props = {
  selected: string[];
  onChange: (ids: string[]) => void;
  /** Show min-city validation (e.g. after publish attempt). */
  showValidation?: boolean;
};

export function MultiCitySelector({ selected, onChange, showValidation }: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const atMax = selected.length >= MULTI_CITY_MAX;
  const needsMore = selected.length < MULTI_CITY_MIN;
  const showError = showValidation && needsMore;

  const filtered = useMemo(() => filterNigerianCities(query, selected), [query, selected]);

  function addCity(id: string) {
    if (selected.includes(id) || selected.length >= MULTI_CITY_MAX) return;
    onChange([...selected, id]);
    setQuery('');
    inputRef.current?.focus();
  }

  function removeCity(id: string) {
    onChange(selected.filter((x) => x !== id));
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Cities</p>
        <span
          className={cn(
            'text-[11px] font-extrabold tabular-nums',
            !needsMore ? 'text-primary' : 'text-muted'
          )}
        >
          {selected.length}/{MULTI_CITY_MAX} selected
        </span>
      </div>

      <div ref={containerRef} className="relative">
        <div
          role="combobox"
          aria-expanded={open && filtered.length > 0}
          aria-haspopup="listbox"
          className={cn(
            'min-h-[52px] cursor-text rounded-2xl border bg-[#F8F9FC] px-3 py-2 transition focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20',
            showError ? 'border-[#EF4444] focus-within:ring-[#EF4444]/20' : 'border-border'
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {selected.length > 0 ? (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {selected.map((id) => (
                <span
                  key={id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full linkup-gradient-primary py-1 pl-2.5 pr-1 text-[11px] font-extrabold text-white shadow-sm"
                >
                  <span className="truncate">{getNigerianCityLabel(id)}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeCity(id);
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20 transition hover:bg-white/30"
                    aria-label={`Remove ${getNigerianCityLabel(id)}`}
                  >
                    <IoClose size={14} aria-hidden />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <IoSearchOutline className="shrink-0 text-muted" size={18} aria-hidden />
            <input
              ref={inputRef}
              type="search"
              value={query}
              disabled={atMax}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder={
                atMax
                  ? 'Maximum cities selected'
                  : selected.length === 0
                    ? 'Search Nigerian cities…'
                    : 'Add another city…'
              }
              autoComplete="off"
              aria-autocomplete="list"
              aria-label="Search cities"
              className="min-w-0 flex-1 bg-transparent py-1.5 text-[14px] font-semibold text-foreground outline-none placeholder:font-medium placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>

        {open && !atMax && filtered.length > 0 ? (
          <ul
            className="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-auto rounded-2xl border border-border bg-white py-1 shadow-lg"
            role="listbox"
            aria-label="City suggestions"
          >
            {filtered.map((city) => (
              <li key={city.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-4 py-2.5 text-left text-[14px] font-semibold text-foreground transition hover:bg-[#F8F7FF]"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addCity(city.id);
                  }}
                >
                  {city.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {open && !atMax && query.trim() && filtered.length === 0 ? (
          <p className="absolute left-0 right-0 z-20 mt-1 rounded-2xl border border-border bg-white px-4 py-3 text-[13px] font-semibold text-muted shadow-lg">
            No cities match &ldquo;{query.trim()}&rdquo;
          </p>
        ) : null}
      </div>

      <p className={cn('text-[12px] font-semibold', showError ? 'text-[#EF4444]' : 'text-muted')}>
        {showError
          ? `Select at least ${MULTI_CITY_MIN} cities (up to ${MULTI_CITY_MAX}).`
          : `Choose ${MULTI_CITY_MIN} to ${MULTI_CITY_MAX} Nigerian cities for discover visibility.`}
      </p>
    </div>
  );
}
