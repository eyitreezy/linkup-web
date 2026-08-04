'use client';

import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import {
  addPromptAnswer,
  availablePromptIds,
  filledPromptAnswers,
  MAX_PROFILE_PROMPTS,
  MIN_REQUIRED_PROMPT_ANSWERS,
  movePromptAnswer,
  PROMPT_ANSWER_MAX_LENGTH,
  promptCatalogEntry,
  removePromptAnswer,
  updatePromptAnswer,
  validatePromptAnswers,
} from '@/lib/onboarding/promptAnswers';
import { HINGE_PROMPTS } from '@/lib/onboarding/constants';
import type { PromptAnswer } from '@/types/onboarding';
import { cn } from '@/utils/cn';
import { useCallback, useEffect, useId, useRef } from 'react';
import { IoAdd, IoChevronDown, IoChevronUp, IoClose } from 'react-icons/io5';

type Props = {
  answers: PromptAnswer[];
  onChange: (next: PromptAnswer[]) => void;
  className?: string;
  showValidation?: boolean;
};

function AutoResizeTextarea({
  id,
  value,
  onChange,
  maxLength,
  placeholder,
  'aria-label': ariaLabel,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  maxLength: number;
  placeholder: string;
  'aria-label': string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(88, el.scrollHeight)}px`;
  }, []);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      id={id}
      value={value}
      rows={3}
      maxLength={maxLength}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      className="mt-2 w-full min-h-[88px] resize-none overflow-hidden rounded-xl border border-border bg-white px-3 py-2.5 text-[14px] font-semibold leading-relaxed outline-none transition-[height,border-color] focus:border-primary/40 focus:ring-2 focus:ring-primary/15"
    />
  );
}

export function ProfilePromptEditor({ answers, onChange, className, showValidation = false }: Props) {
  const baseId = useId();
  const filledCount = filledPromptAnswers(answers).length;
  const unusedIds = availablePromptIds(answers);
  const canAddMore = unusedIds.length > 0 && answers.length < MAX_PROFILE_PROMPTS;
  const validationMessage = showValidation ? validatePromptAnswers(answers) : null;

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <PremiumSectionHead title="Prompts" />
        <p className="mt-1 text-[13px] font-semibold leading-relaxed text-muted">
          <span className="font-extrabold text-foreground">At least {MIN_REQUIRED_PROMPT_ANSWERS} required.</span>{' '}
          Add up to {MAX_PROFILE_PROMPTS} prompts — {filledCount} answered
          {answers.length > 0 ? ` · ${answers.length} selected` : ''}.
        </p>
      </div>

      {answers.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/80 bg-[#F8F9FC] px-4 py-6 text-center">
          <p className="text-[14px] font-semibold text-muted">Pick a prompt below to start sharing more about you.</p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {answers.map((entry, index) => {
          const label = entry.prompt || promptCatalogEntry(entry.promptId)?.text || 'Prompt';
          const answerId = `${baseId}-${entry.promptId}`;
          const charCount = entry.answer.length;
          const atLimit = charCount >= PROMPT_ANSWER_MAX_LENGTH;

          return (
            <li
              key={entry.promptId}
              className="rounded-[18px] border border-transparent bg-white p-[1px] shadow-[0_8px_28px_rgba(42,31,85,0.06)] transition-shadow duration-200"
              style={{
                backgroundImage:
                  'linear-gradient(white, white), linear-gradient(135deg, rgba(108,99,255,0.45), rgba(255,74,114,0.35))',
                backgroundOrigin: 'border-box',
                backgroundClip: 'padding-box, border-box',
              }}
            >
              <div className="rounded-[17px] bg-white p-4 min-[400px]:p-5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[14px] font-extrabold leading-snug text-foreground">{label}</p>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onChange(movePromptAnswer(answers, index, index - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-[#EDE8FF]/80 hover:text-primary disabled:opacity-30"
                      aria-label="Move prompt up"
                    >
                      <IoChevronUp size={16} />
                    </button>
                    <button
                      type="button"
                      disabled={index === answers.length - 1}
                      onClick={() => onChange(movePromptAnswer(answers, index, index + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-[#EDE8FF]/80 hover:text-primary disabled:opacity-30"
                      aria-label="Move prompt down"
                    >
                      <IoChevronDown size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onChange(removePromptAnswer(answers, entry.promptId))}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
                      aria-label="Remove prompt"
                    >
                      <IoClose size={18} />
                    </button>
                  </div>
                </div>

                <AutoResizeTextarea
                  id={answerId}
                  value={entry.answer}
                  onChange={(text) =>
                    onChange(updatePromptAnswer(answers, entry.promptId, { answer: text.slice(0, PROMPT_ANSWER_MAX_LENGTH) }))
                  }
                  maxLength={PROMPT_ANSWER_MAX_LENGTH}
                  placeholder="Your answer…"
                  aria-label={`Answer for ${label}`}
                />

                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-muted">
                    {entry.answer.trim() ? 'Shown on your profile' : 'Optional until you add text'}
                  </span>
                  <span className={cn('text-[11px] font-extrabold tabular-nums', atLimit ? 'text-amber-700' : 'text-muted')}>
                    {charCount}/{PROMPT_ANSWER_MAX_LENGTH}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {canAddMore ? (
        <div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">Add a prompt</p>
          <div className="flex flex-wrap gap-2">
            {unusedIds.map((promptId) => {
              const prompt = HINGE_PROMPTS.find((p) => p.id === promptId);
              if (!prompt) return null;
              return (
                <button
                  key={promptId}
                  type="button"
                  onClick={() => onChange(addPromptAnswer(answers, promptId))}
                  className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/25 bg-[#EDE8FF]/40 px-3 py-2 text-left text-[12px] font-extrabold text-primary transition hover:border-primary/40 hover:bg-[#EDE8FF]/70"
                >
                  <IoAdd size={14} className="shrink-0" aria-hidden />
                  <span className="truncate">{prompt.text}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : answers.length >= MAX_PROFILE_PROMPTS ? (
        <p className="text-[12px] font-semibold text-emerald-700">You&apos;ve added all available prompts.</p>
      ) : null}

      {validationMessage ? (
        <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 text-[13px] font-semibold text-amber-900">
          {validationMessage}
        </p>
      ) : filledCount >= MIN_REQUIRED_PROMPT_ANSWERS ? (
        <p className="text-[12px] font-semibold text-emerald-700">Prompts look good — you can add more or continue.</p>
      ) : null}
    </div>
  );
}
