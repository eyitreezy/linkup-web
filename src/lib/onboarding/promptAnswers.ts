import { HINGE_PROMPTS } from '@/lib/onboarding/constants';
import type { PromptAnswer } from '@/types/onboarding';

export const PROMPT_ANSWER_MAX_LENGTH = 200;
export const MIN_REQUIRED_PROMPT_ANSWERS = 1;
export const MAX_PROFILE_PROMPTS = HINGE_PROMPTS.length;

export function promptCatalogEntry(promptId: string) {
  return HINGE_PROMPTS.find((p) => p.id === promptId);
}

export function filledPromptAnswers(answers: PromptAnswer[]): PromptAnswer[] {
  return answers.filter((p) => p.answer.trim().length > 0);
}

/** Drop duplicate prompt IDs — first occurrence wins. */
export function dedupePromptAnswers(answers: PromptAnswer[]): PromptAnswer[] {
  const seen = new Set<string>();
  return answers.filter((p) => {
    if (seen.has(p.promptId)) return false;
    seen.add(p.promptId);
    return true;
  });
}

export function availablePromptIds(answers: PromptAnswer[]): string[] {
  const used = new Set(answers.map((a) => a.promptId));
  return HINGE_PROMPTS.filter((p) => !used.has(p.id)).map((p) => p.id);
}

export function addPromptAnswer(answers: PromptAnswer[], promptId: string): PromptAnswer[] {
  if (answers.some((a) => a.promptId === promptId)) return answers;
  const entry = promptCatalogEntry(promptId);
  if (!entry) return answers;
  return [...answers, { promptId: entry.id, prompt: entry.text, answer: '' }];
}

export function removePromptAnswer(answers: PromptAnswer[], promptId: string): PromptAnswer[] {
  return answers.filter((a) => a.promptId !== promptId);
}

export function updatePromptAnswer(
  answers: PromptAnswer[],
  promptId: string,
  patch: Partial<Pick<PromptAnswer, 'answer' | 'prompt' | 'promptId'>>
): PromptAnswer[] {
  return answers.map((a) => (a.promptId === promptId ? { ...a, ...patch } : a));
}

export function movePromptAnswer(answers: PromptAnswer[], fromIndex: number, toIndex: number): PromptAnswer[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= answers.length || toIndex >= answers.length) {
    return answers;
  }
  const next = [...answers];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export function validatePromptAnswers(answers: PromptAnswer[]): string | null {
  const deduped = dedupePromptAnswers(answers);
  if (deduped.length !== answers.length) {
    return 'Each prompt can only be selected once.';
  }

  const filled = filledPromptAnswers(answers);
  if (filled.length < MIN_REQUIRED_PROMPT_ANSWERS) {
    return `Answer at least ${MIN_REQUIRED_PROMPT_ANSWERS} prompt to continue.`;
  }

  for (const p of filled) {
    if (p.answer.length > PROMPT_ANSWER_MAX_LENGTH) {
      return `Each prompt answer must be ${PROMPT_ANSWER_MAX_LENGTH} characters or less.`;
    }
    if (!promptCatalogEntry(p.promptId) && !p.prompt.trim()) {
      return 'Choose a valid prompt for each answer.';
    }
  }

  return null;
}

export function exportPromptAnswersForDb(answers: PromptAnswer[]) {
  return dedupePromptAnswers(answers)
    .filter((p) => p.answer.trim())
    .map(({ promptId, prompt, answer }) => ({
      prompt_id: promptId,
      prompt: prompt.trim() || promptCatalogEntry(promptId)?.text || promptId,
      answer: answer.trim(),
    }));
}
