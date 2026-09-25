export type MatchMakerViewerState =
  | 'none'
  | 'interest_sent'
  | 'passed'
  | 'matched'
  | 'self';

export type MatchMakerMemberInteraction = {
  viewerState: MatchMakerViewerState;
  interestStatus: string | null;
  canExpress: boolean;
  canPass: boolean;
};
