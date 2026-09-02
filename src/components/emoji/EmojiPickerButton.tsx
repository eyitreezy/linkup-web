'use client';

import { EmojiPickerPopover } from '@/components/emoji/EmojiPickerPopover';
import { insertTextAtCursor } from '@/lib/emoji/emojiPicker';
import { cn } from '@/utils/cn';
import { useRef, useState, type RefObject } from 'react';
import { IoHappyOutline } from 'react-icons/io5';

type Props = {
  value: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  className?: string;
  buttonClassName?: string;
  placement?: 'above' | 'below' | 'auto';
  disabled?: boolean;
  onSelectionRestore?: (start: number, end: number) => void;
};

export function EmojiPickerButton({
  value,
  onChange,
  inputRef,
  className,
  buttonClassName,
  placement = 'auto',
  disabled,
  onSelectionRestore,
}: Props) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectionRef = useRef({ start: value.length, end: value.length });

  function handleSelect(emoji: string) {
    const el = inputRef?.current;
    const start = el?.selectionStart ?? selectionRef.current.start;
    const end = el?.selectionEnd ?? selectionRef.current.end;
    const { nextValue, nextCursor } = insertTextAtCursor(value, start, end, emoji);
    onChange(nextValue);
    onSelectionRestore?.(nextCursor, nextCursor);
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      el.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function handleToggle() {
    const el = inputRef?.current;
    if (el) {
      selectionRef.current = {
        start: el.selectionStart ?? value.length,
        end: el.selectionEnd ?? value.length,
      };
    }
    setOpen((current) => !current);
  }

  return (
    <div className={cn('relative shrink-0', className)}>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={handleToggle}
        className={cn(
          'mb-1 flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-black/5 disabled:opacity-40 min-[360px]:h-10 min-[360px]:w-10',
          buttonClassName
        )}
        aria-label="Insert emoji"
        aria-expanded={open}
      >
        <IoHappyOutline size={22} />
      </button>
      <EmojiPickerPopover
        open={open}
        onClose={() => setOpen(false)}
        onSelect={handleSelect}
        anchorRef={buttonRef}
        placement={placement}
      />
    </div>
  );
}
