'use client';

import { IoClose } from 'react-icons/io5';

type Props = {
  senderLabel: string;
  preview: string;
  onCancel: () => void;
};

export function ReplyPreviewBar({ senderLabel, preview, onCancel }: Props) {
  return (
    <div className="mx-2.5 mb-1 flex items-center gap-2 rounded-xl border border-primary/15 bg-[#EDE8FF]/50 px-3 py-2 min-[360px]:mx-3">
      <div className="w-1 self-stretch rounded-full bg-primary" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-extrabold text-primary">Replying to {senderLabel}</p>
        <p className="truncate text-[13px] font-semibold text-muted">{preview}</p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-white/80"
        aria-label="Cancel reply"
      >
        <IoClose size={18} />
      </button>
    </div>
  );
}
