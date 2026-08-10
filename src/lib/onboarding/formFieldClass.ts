/** Stable onboarding field styles — border-only focus, no ring-induced layout shift. */
export const onboardingFieldClass =
  'mt-1 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-[14px] font-semibold outline-none transition-[border-color,background-color] focus:border-primary';

export const onboardingTextareaClass = `${onboardingFieldClass} min-h-[80px] resize-y`;

/** Validation highlight without ring-offset layout jump. */
export function onboardingValidationWrapClass(active: boolean): string {
  return active ? 'rounded-3xl outline outline-2 outline-amber-400 outline-offset-0' : '';
}
