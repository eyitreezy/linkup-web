'use client';

import Link from 'next/link';
import { IoChevronForward, IoDiamond, IoSparkles } from 'react-icons/io5';

type Props = {
  isSubscriber: boolean;
  premiumUntilLabel: string | null;
};

export function ProfilePremiumCard({ isSubscriber, premiumUntilLabel }: Props) {
  if (isSubscriber) {
    const renewLine = premiumUntilLabel ? `Renews · ${premiumUntilLabel}` : 'Membership active';
    return (
      <Link
        href="/premium"
        className="block overflow-hidden rounded-3xl linkup-gradient-primary p-[2px] shadow-lg transition hover:opacity-95"
      >
        <div className="flex items-center gap-4 rounded-[22px] bg-white/10 px-5 py-5 backdrop-blur-sm">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-primary">
            <IoDiamond size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <p className="text-[17px] font-extrabold text-white">You&apos;re Premium</p>
            <p className="text-[13px] font-semibold text-white/90">{renewLine}</p>
          </span>
          <span className="flex items-center gap-1 rounded-full bg-white/20 px-3 py-1.5 text-[13px] font-extrabold text-white">
            Manage
            <IoChevronForward size={16} />
          </span>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href="/premium"
      className="block overflow-hidden rounded-3xl linkup-gradient-primary p-[2px] shadow-lg transition hover:opacity-95"
    >
      <div className="rounded-[22px] bg-white/10 px-5 py-6 backdrop-blur-sm">
        <div className="flex items-center gap-2 text-white/90">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary">
            <IoSparkles size={20} />
          </span>
          <span className="text-[11px] font-extrabold uppercase tracking-wide">LinkUp Premium</span>
        </div>
        <p className="mt-3 text-[18px] font-extrabold text-white">Get more visibility on LinkUp</p>
        <p className="mt-1 text-[14px] font-semibold text-white/90">
          Boost your plans, see interest, and stand out
        </p>
        <span className="mt-4 inline-flex items-center gap-1 text-[15px] font-extrabold text-white">
          Upgrade
          <IoChevronForward size={18} />
        </span>
      </div>
    </Link>
  );
}
