'use client';

import { submitUserReport, type ReportReasonCode } from '@/lib/trust/submitReport';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useState } from 'react';
import { IoClose } from 'react-icons/io5';

const REASONS: { code: ReportReasonCode; label: string; sub: string }[] = [
  { code: 'scam', label: 'Scam or fraud', sub: 'Money, off-app payments, or phishing.' },
  { code: 'fake_profile', label: 'Fake profile', sub: "They don't match who they say they are." },
  { code: 'harassment', label: 'Harassment', sub: 'Unwanted pressure, threats, or stalking.' },
  { code: 'inappropriate', label: 'Inappropriate content', sub: 'Sexual, violent, or hateful material.' },
  { code: 'other', label: 'Something else', sub: "We'll review with context." },
];

type Props = {
  open: boolean;
  onClose: () => void;
  reporterId: string;
  reportedUserId: string;
};

export function ChatReportDialog({ open, onClose, reporterId, reportedUserId }: Props) {
  const [reason, setReason] = useState<ReportReasonCode | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = useCallback(() => {
    setReason(null);
    setNote('');
    setBusy(false);
    setErr(null);
    setDone(false);
  }, []);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  if (!open) return null;

  async function submit() {
    if (!reason) return;
    setBusy(true);
    setErr(null);
    const { error } = await submitUserReport({
      reporterId,
      reportedUserId,
      contentType: 'user',
      contentId: null,
      reason,
      note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setErr(error);
      return;
    }
    setDone(true);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-white shadow-xl"
        role="dialog"
        aria-labelledby="chat-report-title"
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 id="chat-report-title" className="font-display text-lg font-extrabold">
            {done ? 'Report submitted' : 'Report'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-muted" aria-label="Close">
            <IoClose size={22} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {done ? (
            <p className="text-[14px] font-semibold leading-relaxed text-muted">
              Thanks — our trust team will review this report. You can track updates in notifications.
            </p>
          ) : !reason ? (
            <ul className="space-y-2">
              {REASONS.map((r) => (
                <li key={r.code}>
                  <button
                    type="button"
                    onClick={() => setReason(r.code)}
                    className="w-full rounded-xl border border-border px-4 py-3 text-left transition hover:border-primary/35 hover:bg-[#EDE8FF]/50"
                  >
                    <span className="block text-[15px] font-extrabold text-foreground">{r.label}</span>
                    <span className="block text-[13px] font-semibold text-muted">{r.sub}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <>
              <p className="mb-2 text-[13px] font-semibold text-muted">Optional details</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="What happened?"
                className="w-full resize-none rounded-xl border border-border px-3 py-2.5 text-[14px] font-medium outline-none focus:border-primary/40"
              />
            </>
          )}
          {err ? <p className="mt-3 text-[13px] font-semibold text-[#EF4444]">{err}</p> : null}
        </div>
        {!done ? (
          <div className="flex gap-2 border-t border-border px-5 py-4">
            {reason ? (
              <>
                <button
                  type="button"
                  onClick={() => setReason(null)}
                  className="flex-1 rounded-full border border-border py-2.5 text-[14px] font-extrabold text-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void submit()}
                  className={cn(
                    'flex-1 rounded-full py-2.5 text-[14px] font-extrabold text-white',
                    busy ? 'bg-muted' : 'linkup-gradient-primary'
                  )}
                >
                  {busy ? 'Sending…' : 'Submit'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full border border-border py-2.5 text-[14px] font-extrabold text-muted"
              >
                Cancel
              </button>
            )}
          </div>
        ) : (
          <div className="border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-full linkup-gradient-primary py-2.5 text-[14px] font-extrabold text-white"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
