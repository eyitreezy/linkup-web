'use client';

import { EmojiPickerButton } from '@/components/emoji/EmojiPickerButton';
import { cn } from '@/utils/cn';
import type { RefObject, TextareaHTMLAttributes } from 'react';
import { useRef } from 'react';

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value: string;
  onValueChange: (value: string) => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  emojiPlacement?: 'above' | 'below';
};

export function TextareaWithEmoji({
  value,
  onValueChange,
  className,
  inputRef,
  emojiPlacement = 'above',
  disabled,
  ...rest
}: Props) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const resolvedRef = inputRef ?? localRef;

  return (
    <div className="relative">
      <textarea
        {...rest}
        ref={resolvedRef}
        value={value}
        disabled={disabled}
        onChange={(e) => onValueChange(e.target.value)}
        className={cn(className, 'pr-12')}
      />
      <div className="absolute bottom-2 right-2">
        <EmojiPickerButton
          value={value}
          onChange={onValueChange}
          inputRef={resolvedRef}
          disabled={disabled}
          placement={emojiPlacement}
          buttonClassName="mb-0 h-8 w-8"
        />
      </div>
    </div>
  );
}
