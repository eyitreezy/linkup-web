'use client';

import { KycDocumentCaptureSlot } from '@/components/kyc/KycDocumentCaptureSlot';
import { KycLivenessCapture } from '@/components/kyc/KycLivenessCapture';
import { FormCard } from '@/components/settings/FormCard';
import { GradientChip } from '@/components/settings/GradientChip';
import { SettingsPageHeader } from '@/components/settings/SettingsPageHeader';
import { PremiumSectionHead } from '@/features/premium/PremiumSectionHead';
import {
  fetchLatestVerificationRequest,
  submitVerificationBundle,
} from '@/lib/verification/submitVerification';
import { createClient } from '@/lib/supabase/client';
import { fetchUserProfileBundle } from '@/services/profile.service';
import { useAuthStore } from '@/stores/auth-store';
import {
  DOCUMENT_TYPE_LABELS,
  KYC_COUNTRY_OPTIONS,
  KYC_TOTAL_STEPS,
  type KycDocumentType,
  type KycStepNumber,
} from '@/types/kyc';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { IoArrowBack, IoArrowForward, IoCheckmark, IoShieldCheckmark } from 'react-icons/io5';

const DOC_TYPES: KycDocumentType[] = ['national_id', 'passport', 'drivers_license', 'voters_card'];

function StepProgress({ step }: { step: KycStepNumber }) {
  if (step < 1 || step > 5) return null;
  const pct = Math.round((step / KYC_TOTAL_STEPS) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[12px] font-extrabold text-muted">
        <span>
          Step {step} of {KYC_TOTAL_STEPS}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#EDE8FF]">
        <div className="h-full rounded-full linkup-gradient-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function KycWizardScreen() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<KycStepNumber>(1);
  const [documentType, setDocumentType] = useState<KycDocumentType | null>(null);
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [idFrontFile, setIdFrontFile] = useState<File | null>(null);
  const [idBackFile, setIdBackFile] = useState<File | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  const idFrontPreview = useMemo(() => (idFrontFile ? URL.createObjectURL(idFrontFile) : null), [idFrontFile]);
  const idBackPreview = useMemo(() => (idBackFile ? URL.createObjectURL(idBackFile) : null), [idBackFile]);
  const videoPreview = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : null), [videoFile]);

  useEffect(() => {
    return () => {
      if (idFrontPreview) URL.revokeObjectURL(idFrontPreview);
      if (idBackPreview) URL.revokeObjectURL(idBackPreview);
      if (videoPreview) URL.revokeObjectURL(videoPreview);
    };
  }, [idFrontPreview, idBackPreview, videoPreview]);

  const { data: bundle } = useQuery({
    queryKey: ['profile-bundle', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      return fetchUserProfileBundle(createClient(), user.id);
    },
    enabled: !!user?.id,
  });

  const status = bundle?.dbUser?.verification_status;

  useEffect(() => {
    if (!user?.id) return;
    let cancel = false;
    (async () => {
      if (status === 'verified') {
        if (!cancel) {
          setStep(7);
          setHydrated(true);
        }
        return;
      }
      if (status === 'pending') {
        if (!cancel) {
          setStep(6);
          setHydrated(true);
        }
        return;
      }
      if (status === 'rejected') {
        const req = await fetchLatestVerificationRequest(user.id);
        if (!cancel) {
          setRejectReason(req?.rejection_reason ?? 'Please upload clearer photos and try again.');
          setStep(7);
          setHydrated(true);
        }
        return;
      }
      if (!cancel) setHydrated(true);
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id, status]);

  async function onSubmitConsent() {
    if (!user?.id || !idFrontFile || !videoFile || !documentType) {
      alert('Choose your ID type, add your document photos, and record your video first.');
      return;
    }
    if (documentType !== 'passport' && !idBackFile) {
      alert('Add both the front and back of your ID.');
      return;
    }
    if (!consent) {
      alert('Please confirm how we use your verification data.');
      return;
    }
    setBusy(true);
    const { error } = await submitVerificationBundle({
      userId: user.id,
      idFile: idFrontFile,
      idBackFile: documentType === 'passport' ? null : idBackFile,
      videoFile,
      countryCode,
      documentType,
      consentAtIso: new Date().toISOString(),
    });
    setBusy(false);
    if (error) {
      alert(`Upload failed: ${error}`);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ['profile-bundle'] });
    setStep(6);
  }

  if (!user) {
    return (
      <p className="text-[14px] font-semibold text-muted">
        <Link href="/login" className="font-extrabold text-primary">
          Sign in
        </Link>{' '}
        to verify your identity.
      </p>
    );
  }

  if (!hydrated) {
    return <div className="h-40 animate-pulse rounded-2xl bg-[#EDE8FF]/70" />;
  }

  const showProgress = step >= 1 && step <= 5;

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-12">
      <SettingsPageHeader
        kicker="Trust & safety"
        title="Identity verification"
        subtitle="A quick check unlocks plans, offers, and escrow with the same 7-step flow as the mobile app."
        backHref="/trust"
        backLabel="Back to verification status"
      />

      {showProgress ? <StepProgress step={step} /> : null}

      {step === 1 && (
        <div className="space-y-6">
          <FormCard>
            <PremiumSectionHead title="Why verify" />
            <ul className="mt-3 space-y-2 text-[14px] font-semibold text-foreground">
              <li className="flex gap-2">
                <span className="text-primary">✓</span> Share meetup ideas with confidence
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span> Chat and plan with people who&apos;ve verified
              </li>
              <li className="flex gap-2">
                <span className="text-primary">✓</span> Optional secure escrow when money is part of the plan
              </li>
            </ul>
            <p className="mt-4 text-[13px] font-semibold leading-relaxed text-muted">
              Your ID and short clip stay private. We use them only to confirm you&apos;re you, like checks from a bank or
              travel app.
            </p>
          </FormCard>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-full linkup-gradient-primary text-[15px] font-extrabold text-white shadow-md"
          >
            Continue
            <IoArrowForward size={18} />
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <PremiumSectionHead title="Choose your ID type" />
          <div className="flex flex-wrap gap-2">
            {DOC_TYPES.map((t) => (
              <GradientChip
                key={t}
                label={DOCUMENT_TYPE_LABELS[t]}
                selected={documentType === t}
                onClick={() => setDocumentType(t)}
              />
            ))}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-full border border-border font-extrabold text-foreground"
            >
              <IoArrowBack size={18} /> Back
            </button>
            <button
              type="button"
              disabled={!documentType}
              onClick={() => setStep(3)}
              className="flex min-h-[48px] flex-[2] items-center justify-center rounded-full linkup-gradient-primary font-extrabold text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 3 && documentType && (
        <div className="space-y-6">
          <PremiumSectionHead title="Government ID" />
          <FormCard>
            <label className="text-[13px] font-extrabold text-foreground">Country of issue</label>
            <select
              className="mt-2 w-full rounded-xl border border-border bg-white px-3 py-2.5 text-[14px] font-semibold"
              value={countryCode ?? ''}
              onChange={(e) => setCountryCode(e.target.value || null)}
            >
              <option value="">Select country</option>
              {KYC_COUNTRY_OPTIONS.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </FormCard>
          <KycDocumentCaptureSlot
            title={documentType === 'passport' ? 'Passport photo page' : 'Front of ID'}
            hint="Place the front of your document inside the frame. Keep all corners visible and text readable."
            value={idFrontFile}
            onChange={setIdFrontFile}
          />
          {documentType !== 'passport' ? (
            <KycDocumentCaptureSlot
              title="Back of ID"
              hint="Flip your document and capture the back clearly. Avoid glare and cropped edges."
              value={idBackFile}
              onChange={setIdBackFile}
            />
          ) : null}
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(2)} className="flex-1 rounded-full border py-3 font-extrabold">
              Back
            </button>
            <button
              type="button"
              disabled={!idFrontFile || (documentType !== 'passport' && !idBackFile)}
              onClick={() => setStep(4)}
              className="flex-[2] rounded-full linkup-gradient-primary py-3 font-extrabold text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-6">
          <PremiumSectionHead title="Liveness video" />
          <KycLivenessCapture value={videoFile} onChange={setVideoFile} />
          <div className="flex gap-3">
            <button type="button" onClick={() => setStep(3)} className="flex-1 rounded-full border py-3 font-extrabold">
              Back
            </button>
            <button
              type="button"
              disabled={!videoFile}
              onClick={() => setStep(5)}
              className="flex-[2] rounded-full linkup-gradient-primary py-3 font-extrabold text-white disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-6">
          <PremiumSectionHead title="Consent" />
          <FormCard>
            <label className="flex cursor-pointer items-start gap-3">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${
                  consent ? 'border-primary bg-primary text-white' : 'border-border'
                }`}
              >
                {consent ? <IoCheckmark size={16} /> : null}
              </span>
              <input
                type="checkbox"
                className="sr-only"
                checked={consent}
                onChange={() => setConsent((c) => !c)}
              />
              <span className="text-[14px] font-semibold leading-relaxed text-foreground">
                I agree to LinkUp processing my verification documents as described in the Privacy Policy.
              </span>
            </label>
          </FormCard>
          <button
            type="button"
            disabled={!consent || busy}
            onClick={() => void onSubmitConsent()}
            className="w-full min-h-[48px] rounded-full linkup-gradient-primary font-extrabold text-white disabled:opacity-50"
          >
            {busy ? 'Submitting…' : 'Submit for review'}
          </button>
        </div>
      )}

      {step === 6 && (
        <FormCard>
          <div className="flex flex-col items-center text-center">
            <IoShieldCheckmark size={48} className="text-primary" />
            <h2 className="mt-4 font-display text-2xl font-extrabold">Submitted</h2>
            <p className="mt-2 text-[14px] font-semibold text-muted">
              We&apos;re reviewing your documents. You&apos;ll get an update in your notification inbox.
            </p>
            <Link href="/trust" className="mt-6 font-extrabold text-primary underline">
              View verification status
            </Link>
          </div>
        </FormCard>
      )}

      {step === 7 && (
        <FormCard>
          {status === 'verified' ? (
            <div className="text-center">
              <IoShieldCheckmark size={48} className="mx-auto text-emerald-600" />
              <h2 className="mt-4 font-display text-2xl font-extrabold text-emerald-900">Verified</h2>
              <p className="mt-2 text-[14px] font-semibold text-muted">You&apos;re cleared for trust-gated features.</p>
            </div>
          ) : rejectReason ? (
            <div className="space-y-4 text-center">
              <h2 className="font-display text-2xl font-extrabold text-red-700">Couldn&apos;t verify</h2>
              <p className="text-[14px] font-semibold text-muted">{rejectReason}</p>
              <button
                type="button"
                onClick={() => {
                  setRejectReason(null);
                  setIdFrontFile(null);
                  setIdBackFile(null);
                  setVideoFile(null);
                  setConsent(false);
                  setDocumentType(null);
                  setStep(2);
                }}
                className="w-full rounded-full linkup-gradient-primary py-3 font-extrabold text-white"
              >
                Try again
              </button>
            </div>
          ) : (
            <p className="text-center font-semibold text-muted">Loading status…</p>
          )}
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="mt-4 w-full rounded-full border py-3 font-extrabold"
          >
            Back to profile
          </button>
        </FormCard>
      )}
    </div>
  );
}
