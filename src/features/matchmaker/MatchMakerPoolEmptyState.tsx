'use client';

import { MatchMakerTabIcon } from '@/components/navigation/MatchMakerTabIcon';
import { AppEmptyState } from '@/components/ui/AppEmptyState';
import type { MatchMakerPoolEmptyReason } from '@/services/matchmaker.service';
import {
  IoLocationOutline,
  IoOptionsOutline,
  IoPersonOutline,
  IoShieldCheckmark,
  IoTimeOutline,
} from 'react-icons/io5';

type Props = {
  reason: MatchMakerPoolEmptyReason;
  className?: string;
};

export function MatchMakerPoolEmptyState({ reason, className }: Props) {
  switch (reason) {
    case 'gender_not_set':
      return (
        <AppEmptyState
          className={className}
          icon={<IoPersonOutline size={40} className="text-primary" />}
          title="Complete your profile first"
          description="Add your gender to your profile so we can find the right matches for you."
          action={{
            label: 'Update profile',
            href: '/profile/edit',
            variant: 'primary',
          }}
        />
      );

    case 'dealbreakers_strict':
      return (
        <AppEmptyState
          className={className}
          icon={<IoOptionsOutline size={40} className="text-primary" />}
          title="Your filters are quite specific"
          titleAccent="specific"
          description="Your dealbreaker settings may be narrowing the pool. Try relaxing one or two to see more profiles."
          action={{
            label: 'Review dealbreakers',
            href: '/matchmaker/values',
            variant: 'primary',
          }}
        />
      );

    case 'location_narrow':
      return (
        <AppEmptyState
          className={className}
          icon={<IoLocationOutline size={40} className="text-primary" />}
          title="No one close by right now"
          titleAccent="close"
          description="There are no verified MatchMaker members within your distance range yet. Try widening your range."
          action={{
            label: 'Adjust distance',
            href: '/matchmaker/values',
            variant: 'primary',
          }}
        />
      );

    case 'genuinely_empty':
    default:
      return (
        <AppEmptyState
          className={className}
          icon={<MatchMakerTabIcon size={40} className="text-[#9B1B4B]/70" />}
          title="Your pool is quiet right now"
          titleAccent="quiet"
          description="Your match may still be on the way. The pool refreshes as new members join."
          tips={[
            {
              icon: IoTimeOutline,
              text: 'New members join every day',
              iconClassName: 'text-primary',
              iconBgClassName: 'bg-primary/10',
            },
            {
              icon: IoShieldCheckmark,
              text: 'Every profile is identity-verified',
              iconClassName: 'text-emerald-600',
              iconBgClassName: 'bg-emerald-500/10',
            },
          ]}
          tipsLabel="While you wait"
        />
      );
  }
}
