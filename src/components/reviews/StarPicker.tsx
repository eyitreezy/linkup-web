'use client';

import { cn } from '@/utils/cn';
import { useState } from 'react';

type StarPickerProps = {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
};

export function StarPicker({ label, hint, value, onChange }: StarPickerProps) {
  const [hovered, setHovered] = useState(0);

  return (
    <div>
      <label className="text-[13px] font-extrabold text-foreground">{label}</label>
      {hint ? <p className="mt-0.5 text-[12px] font-semibold text-muted">{hint}</p> : null}
      <div className="mt-2 flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            className="text-2xl transition-colors focus:outline-none"
            aria-label={`${star} star${star !== 1 ? 's' : ''}`}
          >
            <span className={star <= (hovered || value) ? 'text-amber-500' : 'text-[#E5E7EB]'}>
              ★
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function computeHostReviewOverall(
  punctuality: number,
  conduct: number,
  planQuality: number | null
): number {
  const quality = planQuality ?? conduct;
  return Math.round((quality * 0.4 + conduct * 0.35 + punctuality * 0.25) * 10) / 10;
}
