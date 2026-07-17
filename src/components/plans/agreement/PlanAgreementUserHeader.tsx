import { AvatarWithPresence } from '@/components/presence/AvatarWithPresence';
import type { ReactNode } from 'react';
import { IoShieldCheckmark } from 'react-icons/io5';

export type AgreementParty = {
  userId: string;
  name: string;
  avatarUrl: string | null;
  verified: boolean;
};

type Props = {
  host: AgreementParty;
  guest: AgreementParty;
};

function AvatarRing({
  children,
  gradientClass,
}: {
  children: ReactNode;
  gradientClass: string;
}) {
  return (
    <div className={`rounded-full p-[3px] ${gradientClass}`}>
      <div className="overflow-hidden rounded-full bg-white">{children}</div>
    </div>
  );
}

export function PlanAgreementUserHeader({ host, guest }: Props) {
  return (
    <div className="flex flex-col items-center">
      <div className="mb-4 flex items-center justify-center">
        <div className="relative z-[1] -mr-4">
          <AvatarRing gradientClass="linkup-gradient-primary">
            <AvatarWithPresence
              uri={host.avatarUrl}
              name={host.name}
              size={62}
              presence={null}
              showDot={false}
            />
          </AvatarRing>
          {host.verified ? (
            <IoShieldCheckmark
              className="absolute bottom-1 right-1 rounded-full bg-white text-primary"
              size={18}
            />
          ) : null}
        </div>
        <div className="relative z-0">
          <AvatarRing gradientClass="bg-gradient-to-br from-secondary to-emerald-500">
            <AvatarWithPresence
              uri={guest.avatarUrl}
              name={guest.name}
              size={62}
              presence={null}
              showDot={false}
            />
          </AvatarRing>
          {guest.verified ? (
            <IoShieldCheckmark
              className="absolute bottom-1 right-1 rounded-full bg-white text-primary"
              size={18}
            />
          ) : null}
        </div>
      </div>
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2 px-4">
        <p className="truncate text-[17px] font-extrabold text-foreground">{host.name}</p>
        <span className="text-[16px] font-bold text-muted">·</span>
        <p className="truncate text-[17px] font-extrabold text-foreground">{guest.name}</p>
      </div>
      <p className="mt-1 text-[13px] font-semibold text-muted">Host and guest for this plan</p>
    </div>
  );
}
