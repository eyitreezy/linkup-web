export type AgreementAlertVariant = 'error' | 'info';

export function agreementAlertMeta(message: string): { title: string; variant: AgreementAlertVariant } {
  const m = message.trim();
  if (m.includes('Both parties must confirm')) {
    return {
      title: 'Confirmation needed',
      variant: 'info',
    };
  }
  if (m.includes('Identity verification is required')) {
    return {
      title: 'Verification required',
      variant: 'info',
    };
  }
  if (m.includes('not eligible')) {
    return {
      title: 'Payment unavailable',
      variant: 'error',
    };
  }
  if (m.includes('Could not open chat')) {
    return {
      title: 'Chat unavailable',
      variant: 'error',
    };
  }
  return {
    title: 'Could not continue',
    variant: 'error',
  };
}
