import type { MatchMakerMemberInteraction, MatchMakerViewerState } from '@/types/matchmaker-interaction';

export function parseMemberInteractionPayload(data: unknown): MatchMakerMemberInteraction {
  const payload = (typeof data === 'string' ? JSON.parse(data) : data) as {
    viewer_state?: string;
    interest_status?: string | null;
    can_express?: boolean;
    can_pass?: boolean;
  };

  const viewerState = (payload.viewer_state ?? 'none') as MatchMakerViewerState;

  return {
    viewerState,
    interestStatus: payload.interest_status ?? null,
    canExpress: !!payload.can_express,
    canPass: !!payload.can_pass,
  };
}

export function interactionStatusLabel(state: MatchMakerViewerState): string | null {
  switch (state) {
    case 'interest_sent':
      return 'Interest sent';
    case 'passed':
      return 'You passed on this profile';
    case 'matched':
      return 'Already connected';
    default:
      return null;
  }
}
