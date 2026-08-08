'use client';

import { cn } from '@/utils/cn';

type Props = {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: 'hours' | 'minutes';
  presets?: readonly number[];
  formatValue?: (value: number) => string;
  onChange: (value: number) => void;
  className?: string;
};

function defaultFormat(value: number, unit: 'hours' | 'minutes'): string {
  if (unit === 'hours') return value === 1 ? '1 hour' : `${value} hours`;
  if (value < 60) return `${value} min`;
  const h = Math.floor(value / 60);
  const m = value % 60;
  if (m === 0) return h === 1 ? '1 hour' : `${h} hours`;
  return `${h}h ${m}m`;
}

export function FlexibleHourSelector({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  presets,
  formatValue,
  onChange,
  className,
}: Props) {
  const display = formatValue ? formatValue(value) : defaultFormat(value, unit);

  function clamp(next: number) {
    return Math.max(min, Math.min(max, Math.round(next / step) * step));
  }

  return (
    <div className={cn('space-y-3', className)}>
      <p className="text-[12px] font-extrabold uppercase tracking-wide text-muted">{label}</p>
      <div className="flex items-center justify-center gap-4 rounded-2xl border border-border bg-white px-4 py-4">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          onClick={() => onChange(clamp(value - step))}
          disabled={value <= min}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-xl font-extrabold text-primary transition hover:border-primary/40 disabled:opacity-40"
        >
          −
        </button>
        <div className="min-w-[120px] text-center">
          <p className="font-display text-xl font-extrabold text-foreground">{display}</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted">
            {min} to {max} {unit}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Increase ${label}`}
          onClick={() => onChange(clamp(value + step))}
          disabled={value >= max}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-border text-xl font-extrabold text-primary transition hover:border-primary/40 disabled:opacity-40"
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
        className="w-full accent-primary"
        aria-label={`${label} slider`}
      />
      {presets?.length ? (
        <div className="flex flex-wrap gap-2">
          {presets.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(clamp(preset))}
              className={cn(
                'rounded-full px-3 py-1.5 text-[12px] font-extrabold transition',
                value === preset ? 'linkup-gradient-primary text-white' : 'bg-primary/10 text-primary'
              )}
            >
              {formatValue ? formatValue(preset) : defaultFormat(preset, unit)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
