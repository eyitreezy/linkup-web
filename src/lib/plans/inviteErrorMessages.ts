/** User-facing invitation dialog copy (web). No em or en dashes in user-visible text. */

/** Stable client error codes for group-plan invitation flows. */
export type InviteClientErrorCode =
  | 'NO_SLOTS'
  | 'ALREADY_INVITED'
  | 'INVALID_EMAIL'
  | 'NOT_HOST'
  | 'GROUP_ONLY'
  | 'GROUP_CLOSED'
  | 'PLAN_EXPIRED'
  | 'PLAN_NOT_FOUND'
  | 'NOT_AUTHENTICATED'
  | 'DELIVERY_FAILED'
  | 'INVITE_FAILED';

export function mapInviteClientError(raw: string): InviteClientErrorCode {
  const code = raw.toLowerCase();
  if (raw === 'NOT_AUTHENTICATED' || code.includes('not_authenticated')) return 'NOT_AUTHENTICATED';
  if (code.includes('no_slots')) return 'NO_SLOTS';
  if (code.includes('invalid_email')) return 'INVALID_EMAIL';
  if (code.includes('not_plan_host')) return 'NOT_HOST';
  if (code.includes('invitations_group_only')) return 'GROUP_ONLY';
  if (code.includes('group_already_closed')) return 'GROUP_CLOSED';
  if (code.includes('plan_listing_expired') || code.includes('plan_expired')) return 'PLAN_EXPIRED';
  if (code.includes('plan_not_found')) return 'PLAN_NOT_FOUND';
  if (code.includes('unauthorized') || code.includes('not_authenticated')) return 'NOT_AUTHENTICATED';
  if (code.includes('host_auth_required')) return 'NOT_AUTHENTICATED';
  if (
    code.includes('misconfigured') ||
    code.includes('email_failed') ||
    code.includes('magic_link')
  ) {
    return 'DELIVERY_FAILED';
  }
  if (code.includes('duplicate') || code.includes('already') || code.includes('invitation_already')) {
    return 'ALREADY_INVITED';
  }
  return 'INVITE_FAILED';
}

export function inviteErrorDialogContent(code: InviteClientErrorCode): {
  title: string;
  message: string;
} {
  switch (code) {
    case 'NO_SLOTS':
      return {
        title: 'No slots available',
        message: 'Slots free up when invitations expire or are declined.',
      };
    case 'ALREADY_INVITED':
      return {
        title: 'Already invited',
        message: 'This person already has an active invitation for this plan.',
      };
    case 'INVALID_EMAIL':
      return {
        title: 'Invalid email',
        message: 'Enter a valid email address and try again.',
      };
    case 'PLAN_EXPIRED':
      return {
        title: 'Plan expired',
        message: 'This plan has already ended and is no longer accepting invitations.',
      };
    case 'NOT_HOST':
      return {
        title: 'Cannot send invitation',
        message: 'Only the plan host can send invitations.',
      };
    case 'GROUP_ONLY':
      return {
        title: 'Group plans only',
        message: 'Invitations are only available for group plans.',
      };
    case 'GROUP_CLOSED':
      return {
        title: 'Group closed',
        message: 'This group plan is no longer accepting new members.',
      };
    case 'NOT_AUTHENTICATED':
      return {
        title: 'Sign in required',
        message: 'Sign in to send invitations.',
      };
    case 'DELIVERY_FAILED':
      return {
        title: 'Could not send invitation',
        message: 'The email could not be delivered. Please try again in a few minutes.',
      };
    case 'PLAN_NOT_FOUND':
      return {
        title: 'Plan not found',
        message: 'This plan may have been removed.',
      };
    default:
      return {
        title: 'Could not send invitation',
        message: 'Please try again in a few minutes.',
      };
  }
}

export function inviteSuccessDialogContent(
  email?: string,
  delivery: 'email' | 'in_app' = email ? 'email' : 'in_app',
  emailSent = true,
  emailError?: string
): { title: string; message: string } {
  if (delivery === 'in_app') {
    return {
      title: 'Invitation sent',
      message: 'They already use LinkUp and were notified in the app.',
    };
  }
  if (email && emailSent === false) {
    if (emailError === 'domain_not_verified') {
      return {
        title: 'Invitation saved',
        message:
          'The invitation was saved, but email delivery is not set up yet. Verify your sending domain in Resend, then try again.',
      };
    }
    return {
      title: 'Invitation saved',
      message:
        'The invitation was saved, but the email could not be sent. Retry from Sent invitations after checking your email setup.',
    };
  }
  if (email) {
    return {
      title: 'Invitation sent',
      message: `An invitation email was sent to ${email}. Ask them to check spam if it does not arrive soon.`,
    };
  }
  return {
    title: 'Invitation sent',
    message: 'Your invitation email is on its way.',
  };
}
