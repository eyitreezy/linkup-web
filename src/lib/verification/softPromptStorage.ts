const SOFT_KYC_KEY = 'linkup/soft_kyc_prompt_pending';

/** Call after onboarding completes — show one friendly prompt on Discover. */
export async function markSoftKycPromptPending(): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SOFT_KYC_KEY, '1');
}

export async function clearSoftKycPromptPending(): Promise<void> {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SOFT_KYC_KEY);
}

export async function consumeSoftKycPromptPending(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const v = localStorage.getItem(SOFT_KYC_KEY);
  if (v !== '1') return false;
  localStorage.removeItem(SOFT_KYC_KEY);
  return true;
}

export async function peekSoftKycPromptPending(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(SOFT_KYC_KEY) === '1';
}
