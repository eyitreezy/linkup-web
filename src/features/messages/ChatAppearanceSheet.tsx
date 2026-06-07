'use client';

import {
  CHAT_APPEARANCE_PRESET_ORDER,
  CHAT_APPEARANCE_PRESETS,
  DEFAULT_CHAT_APPEARANCE,
  type ChatAppearanceState,
  type ChatFontEmphasis,
  type ChatFontScale,
} from '@/lib/messaging/chatAppearance';
import { cn } from '@/utils/cn';
import { useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';

type Props = {
  open: boolean;
  onClose: () => void;
  value: ChatAppearanceState;
  onSave: (next: ChatAppearanceState) => void;
};

export function ChatAppearanceSheet({ open, onClose, value, onSave }: Props) {
  const [draft, setDraft] = useState<ChatAppearanceState>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  function apply() {
    onSave(draft);
    onClose();
  }

  function pickWallpaper(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const uri = typeof reader.result === 'string' ? reader.result : null;
      if (uri) setDraft((d) => ({ ...d, backgroundImageUri: uri }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-border bg-white shadow-xl sm:rounded-3xl">
        <div className="shrink-0 border-b border-border px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-extrabold">Chat look</h2>
              <p className="text-[13px] font-semibold text-muted">Colors, wallpaper, and message text.</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-muted" aria-label="Close">
              <IoClose size={22} />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {CHAT_APPEARANCE_PRESET_ORDER.map((id) => {
              const p = CHAT_APPEARANCE_PRESETS[id];
              const selected = draft.presetId === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, presetId: id }))}
                  className={cn(
                    'overflow-hidden rounded-xl border-2 p-0.5 transition',
                    selected ? 'border-primary' : 'border-transparent'
                  )}
                >
                  <div
                    className="h-14 rounded-lg"
                    style={{
                      background: `linear-gradient(135deg, ${p.threadGradient.slice(0, 3).join(', ')})`,
                    }}
                  />
                  <span className="block py-1.5 text-center text-[11px] font-extrabold text-foreground">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Wallpaper</p>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-full border border-border px-4 py-2 text-[13px] font-extrabold text-primary hover:bg-[#EDE8FF]/60">
              Upload image
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => pickWallpaper(e.target.files?.[0])}
              />
            </label>
            {draft.backgroundImageUri ? (
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, backgroundImageUri: null }))}
                className="rounded-full border border-border px-4 py-2 text-[13px] font-extrabold text-muted"
              >
                Remove
              </button>
            ) : null}
          </div>

          <p className="mb-2 mt-5 text-[11px] font-extrabold uppercase tracking-wide text-muted">Text size</p>
          <div className="flex gap-2">
            {(['s', 'm', 'l'] as ChatFontScale[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, fontScale: s }))}
                className={cn(
                  'flex-1 rounded-full py-2 text-[13px] font-extrabold',
                  draft.fontScale === s ? 'linkup-gradient-primary text-white' : 'border border-border text-muted'
                )}
              >
                {s === 's' ? 'Small' : s === 'l' ? 'Large' : 'Medium'}
              </button>
            ))}
          </div>

          <p className="mb-2 mt-4 text-[11px] font-extrabold uppercase tracking-wide text-muted">Weight</p>
          <div className="flex gap-2">
            {(['normal', 'bold'] as ChatFontEmphasis[]).map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, fontEmphasis: e }))}
                className={cn(
                  'flex-1 rounded-full py-2 text-[13px] font-extrabold',
                  draft.fontEmphasis === e ? 'linkup-gradient-primary text-white' : 'border border-border text-muted'
                )}
              >
                {e === 'bold' ? 'Bold' : 'Regular'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex shrink-0 gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={() => setDraft({ ...DEFAULT_CHAT_APPEARANCE })}
            className="rounded-full border border-border px-4 py-2.5 text-[13px] font-extrabold text-muted"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={apply}
            className="flex-1 rounded-full linkup-gradient-primary py-2.5 text-[14px] font-extrabold text-white"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
