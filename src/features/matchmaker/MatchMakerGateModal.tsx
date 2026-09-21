'use client';

import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { useRouter } from 'next/navigation';
import { IoShieldCheckmark, IoTimeOutline, IoWarningOutline } from 'react-icons/io5';

export type MatchMakerGateModalState = 'subscription' | 'kyc' | 'cooldown' | 'suspended';

type Props = {
  gate: MatchMakerGateModalState;
  cooldownDaysRemaining?: number;
  cooldownUntil?: string;
  suspensionDaysRemaining?: number;
  onDismiss?: () => void;
};

export function MatchMakerGateModal({
  gate,
  cooldownDaysRemaining,
  cooldownUntil,
  suspensionDaysRemaining,
  onDismiss,
}: Props) {
  const router = useRouter();

  const config = {
    subscription: {
      icon: <MatchMakerTabIcon size={48} color="#9B1B4B" />,
      heading: 'MatchMaker is a Gold feature and above',
      body: 'Upgrade to Gold or a subscription plan higher than Gold to access intentional matchmaking designed for people serious about finding a long-term relationship.',
      cta: 'Upgrade to Gold',
      ctaGradient: true,
      onCta: () => router.push('/subscription'),
    },
    kyc: {
      icon: <IoShieldCheckmark size={48} color="#6C63FF" />,
      heading: 'Verify your identity first',
      body: 'MatchMaker requires identity verification before you enter the pool, to protect you and every other member.',
      cta: 'Complete verification',
      ctaGradient: true,
      onCta: () => router.push('/kyc'),
    },
    cooldown: {
      icon: <IoTimeOutline size={48} color="#7B6E65" />,
      heading: `MatchMaker is paused for ${cooldownDaysRemaining ?? 0} day${cooldownDaysRemaining === 1 ? '' : 's'}`,
      body: cooldownUntil
        ? `MatchMaker is built for intentional connections. Your access resumes on ${new Date(cooldownUntil).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}.`
        : 'MatchMaker is built for intentional connections. Your access will resume soon.',
      cta: 'Got it',
      ctaGradient: false,
      onCta: onDismiss,
    },
    suspended: {
      icon: <IoWarningOutline size={48} color="#9B1B4B" />,
      heading: 'MatchMaker access suspended',
      body: `Your MatchMaker access is suspended for ${suspensionDaysRemaining ?? 0} day${suspensionDaysRemaining === 1 ? '' : 's'} due to a contact-sharing policy violation. All other LinkUp features remain accessible.`,
      cta: 'Got it',
      ctaGradient: false,
      onCta: onDismiss,
    },
  }[gate];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]">
      <div
        className="linkup-card w-full max-w-sm space-y-5 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-2">{config.icon}</div>

        <h2 className="text-center font-display text-[20px] font-extrabold leading-snug text-foreground">
          {config.heading}
        </h2>

        <p className="text-center text-[14px] leading-relaxed text-muted">{config.body}</p>

        {config.ctaGradient ? (
          <button
            type="button"
            onClick={config.onCta}
            className="linkup-gradient-primary w-full min-h-[48px] rounded-full text-[15px] font-extrabold text-white transition hover:opacity-95 active:scale-[0.98]"
          >
            {config.cta}
          </button>
        ) : (
          <button
            type="button"
            onClick={config.onCta}
            className="w-full min-h-[48px] rounded-full border border-border bg-surface text-[15px] font-extrabold text-foreground transition hover:bg-background"
          >
            {config.cta}
          </button>
        )}
      </div>
    </div>
  );
}
