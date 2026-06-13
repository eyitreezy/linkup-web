'use client';

type Props = {
  open: boolean;
  draft: string;
  busy?: boolean;
  error?: string | null;
  onDraftChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void | Promise<void>;
};

export function EditMessageDialog({
  open,
  draft,
  busy,
  error,
  onDraftChange,
  onClose,
  onSave,
}: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[75] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-message-title"
      onClick={onClose}
    >
      <div
        className="linkup-card w-full max-w-md rounded-2xl p-4 shadow-xl min-[425px]:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="edit-message-title" className="font-display text-lg font-extrabold text-foreground">
          Edit message
        </h2>
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          rows={4}
          autoFocus
          placeholder="Message"
          className="mt-3 w-full resize-none rounded-2xl border border-border bg-[#F8F7FF] px-4 py-3 text-[15px] font-semibold text-foreground outline-none focus:border-primary"
        />
        {error ? (
          <p className="mt-2 text-[13px] font-semibold text-[#EF4444]">{error}</p>
        ) : null}
        <div className="mt-4 flex flex-col-reverse gap-2 min-[425px]:flex-row min-[425px]:justify-end min-[425px]:gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-[44px] rounded-full border border-border px-5 text-[14px] font-extrabold text-muted transition hover:bg-[#EDE8FF]/50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !draft.trim()}
            onClick={() => void onSave()}
            className="min-h-[44px] rounded-full linkup-gradient-primary px-5 text-[14px] font-extrabold text-white transition hover:opacity-95 disabled:opacity-50"
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
