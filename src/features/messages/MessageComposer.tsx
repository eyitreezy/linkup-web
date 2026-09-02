'use client';

import { EmojiPickerButton } from '@/components/emoji/EmojiPickerButton';
import { cn } from '@/utils/cn';
import { IoAddCircleOutline, IoArrowUp } from 'react-icons/io5';
import type { ReactNode, RefObject } from 'react';
import { useRef, useState } from 'react';

export type MessageComposerLook = {
  inputBg: string;
  inputText: string;
  inputBorder: string;
  inputPlaceholder: string;
  attachIcon: string;
  sendActive: [string, string];
  fontSize?: number;
  fontWeight?: '400' | '700';
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach: (file: File) => void;
  sending: boolean;
  disabled?: boolean;
  threadLook?: MessageComposerLook | null;
  /** Narrow viewports — tighter input row. */
  compact?: boolean;
  /** Replaces attach on mobile (e.g. + toggle for tools). */
  leadingSlot?: ReactNode;
  hideAttachButton?: boolean;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  placeholder?: string;
  onSelectionChange?: (start: number, end: number) => void;
};

export function MessageComposer({
  value,
  onChange,
  onSend,
  onAttach,
  sending,
  disabled,
  threadLook,
  compact,
  leadingSlot,
  hideAttachButton,
  inputRef,
  placeholder,
  onSelectionChange,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const localInputRef = useRef<HTMLTextAreaElement>(null);
  const resolvedInputRef = inputRef ?? localInputRef;
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const canSend = value.trim().length > 0 && !sending && !disabled;
  const tl = threadLook;

  function updateSelection(start: number, end: number) {
    setSelection({ start, end });
    onSelectionChange?.(start, end);
  }

  return (
    <div className={cn('px-2 pb-2 pt-1 min-[360px]:px-3 min-[360px]:pb-3', compact && 'px-2')}>
      <div className="flex min-w-0 items-end gap-1.5 min-[360px]:gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onAttach(file);
            e.target.value = '';
          }}
        />
        {leadingSlot}
        {!hideAttachButton ? (
          <button
            type="button"
            disabled={sending || disabled}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'mb-1 flex shrink-0 items-center justify-center rounded-full transition',
              compact ? 'h-9 w-9' : 'h-10 w-10',
              sending || disabled ? 'opacity-40' : 'hover:bg-black/5'
            )}
            style={{ color: tl?.attachIcon }}
            aria-label="Attach photo or video"
          >
            <IoAddCircleOutline size={compact ? 24 : 28} />
          </button>
        ) : null}
        <EmojiPickerButton
          value={value}
          onChange={onChange}
          inputRef={resolvedInputRef}
          disabled={sending || disabled}
          placement="auto"
          onSelectionRestore={(start, end) => updateSelection(start, end)}
        />
        <textarea
          ref={resolvedInputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Message…'}
          rows={1}
          maxLength={4000}
          disabled={sending || disabled}
          className={cn(
            'max-h-[120px] min-w-0 flex-1 resize-none rounded-[20px] border-[1.5px] font-medium outline-none min-[360px]:rounded-[22px]',
            compact ? 'min-h-[40px] px-3 py-2 text-[14px]' : 'min-h-[44px] px-4 py-2.5',
            !tl && 'border-primary/20 bg-white text-foreground placeholder:text-muted focus:border-primary/40'
          )}
          style={
            tl
              ? {
                  backgroundColor: tl.inputBg,
                  color: tl.inputText,
                  borderColor: tl.inputBorder,
                  fontSize: tl.fontSize,
                  fontWeight: tl.fontWeight,
                }
              : undefined
          }
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          onSelect={(e) => {
            const target = e.currentTarget;
            updateSelection(target.selectionStart ?? 0, target.selectionEnd ?? 0);
          }}
          onClick={(e) => {
            const target = e.currentTarget;
            updateSelection(target.selectionStart ?? 0, target.selectionEnd ?? 0);
          }}
          onKeyUp={(e) => {
            const target = e.currentTarget;
            updateSelection(target.selectionStart ?? 0, target.selectionEnd ?? 0);
          }}
          onFocus={(e) => {
            const target = e.currentTarget;
            updateSelection(target.selectionStart ?? selection.start, target.selectionEnd ?? selection.end);
          }}
        />
        <button
          type="button"
          disabled={!canSend}
          onClick={onSend}
          className={cn(
            'mb-0.5 flex shrink-0 items-center justify-center rounded-full shadow-md transition text-white',
            compact ? 'h-10 w-10' : 'h-11 w-11',
            canSend && !tl && 'linkup-gradient-primary',
            !canSend && 'bg-[#D1D5DB] opacity-50'
          )}
          style={
            canSend && tl
              ? { background: `linear-gradient(135deg, ${tl.sendActive[0]}, ${tl.sendActive[1]})` }
              : undefined
          }
          aria-label="Send message"
        >
          {sending ? (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <IoArrowUp size={compact ? 20 : 22} />
          )}
        </button>
      </div>
    </div>
  );
}
