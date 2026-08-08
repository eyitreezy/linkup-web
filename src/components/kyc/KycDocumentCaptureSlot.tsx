'use client';

import { cn } from '@/utils/cn';
import { useEffect, useMemo, useRef, useState } from 'react';
import { IoCamera, IoClose, IoImageOutline, IoRefresh } from 'react-icons/io5';

type Props = {
  title: string;
  hint: string;
  value: File | null;
  onChange: (file: File | null) => void;
  captureMode?: 'environment' | 'user';
};

export function KycDocumentCaptureSlot({ title, hint, value, onChange, captureMode = 'environment' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrl = useMemo(() => (value ? URL.createObjectURL(value) : null), [value]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  return (
    <div className="rounded-[18px] border border-transparent bg-white p-[1px] shadow-[0_8px_28px_rgba(42,31,85,0.06)]">
      <div
        className="rounded-[17px] bg-white p-4"
        style={{
          backgroundImage:
            'linear-gradient(white, white), linear-gradient(135deg, rgba(108,99,255,0.45), rgba(255,74,114,0.35))',
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }}
      >
        <p className="text-[14px] font-extrabold text-foreground">{title}</p>
        <p className="mt-1 text-[12px] font-semibold leading-relaxed text-muted">{hint}</p>

        <div
          className={cn(
            'relative mt-4 flex aspect-[1.58/1] w-full flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed',
            previewUrl ? 'border-primary/30 bg-[#F8F9FC]' : 'border-border bg-[#FAFBFF]'
          )}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt={title} className="h-full w-full object-contain" />
          ) : (
            <>
              <IoImageOutline size={32} className="text-primary/50" />
              <p className="mt-2 px-4 text-center text-[12px] font-semibold text-muted">
                Align all four corners inside the frame. Avoid blur, glare, and shadows.
              </p>
            </>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture={captureMode}
          className="sr-only"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-2 rounded-full linkup-gradient-primary px-4 text-[13px] font-extrabold text-white"
          >
            <IoCamera size={16} />
            {value ? 'Retake' : 'Capture'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (inputRef.current) {
                inputRef.current.removeAttribute('capture');
                inputRef.current.click();
                inputRef.current.setAttribute('capture', captureMode);
              }
            }}
            className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-border px-4 text-[13px] font-extrabold text-foreground"
          >
            <IoRefresh size={16} />
            Upload
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex min-h-[40px] items-center justify-center gap-1 rounded-full border border-red-200 px-3 text-[13px] font-extrabold text-red-700"
            >
              <IoClose size={16} />
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
