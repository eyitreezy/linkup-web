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
  if (m.includes('no_accepted_offer')) {
    return {
      title: 'Cancellation unavailable',
      variant: 'error',
    };
  }
  if (m.includes('use_group_host_cancellation')) {
    return {
      title: 'Use group cancellation',
      variant: 'info',
    };
  }
  if (m.includes('close_group_first') || m.includes('Close the group first')) {
    return {
      title: 'Close the group first',
      variant: 'info',
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

export function formatAgreementAlertMessage(message: string): string {
  const m = message.trim();
  if (m.includes('no_accepted_offer')) {
    return 'This plan uses join requests instead of a negotiated offer. Use the group cancellation flow to cancel.';
  }
  if (m.includes('use_group_host_cancellation')) {
    return 'Group plans must be cancelled using the host cancellation flow with reason and policy review.';
  }
  if (m.includes('not eligible')) {
    return 'You are not eligible to continue with this step right now. Check your plan status and try again.';
  }
  if (m.includes('not authenticated')) {
    return 'Please sign in and try again.';
  }
  if (m.includes('forbidden')) {
    return 'You do not have permission to perform this action on this plan.';
  }
  if (m.includes('plan_not_cancellable')) {
    return 'This plan cannot be cancelled in its current state.';
  }
  return message;
}
