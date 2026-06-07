export type KycDocumentType = 'national_id' | 'passport' | 'drivers_license' | 'voters_card';

export type KycStepNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const KYC_TOTAL_STEPS = 7;

export const KYC_COUNTRY_OPTIONS: { code: string; label: string }[] = [
  { code: 'NG', label: 'Nigeria' },
  { code: 'US', label: 'United States' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'GH', label: 'Ghana' },
  { code: 'KE', label: 'Kenya' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'OTHER', label: 'Other' },
];

export const DOCUMENT_TYPE_LABELS: Record<KycDocumentType, string> = {
  national_id: 'National ID',
  passport: 'Passport',
  drivers_license: "Driver's license",
  voters_card: "Voter's card",
};
