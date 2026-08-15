export type PlanExpiredAction = 'offer' | 'join' | 'share' | 'invite';

const MESSAGES: Record<PlanExpiredAction, string> = {
  offer: 'This plan has already ended and is no longer accepting offers.',
  join: 'This plan has already ended and is no longer accepting join requests.',
  share: 'This plan has already ended and can no longer be shared.',
  invite: 'This plan has already ended and is no longer accepting invitations.',
};

export function planExpiredDialogContent(action: PlanExpiredAction): {
  title: string;
  message: string;
} {
  return {
    title: 'Plan expired',
    message: MESSAGES[action],
  };
}
