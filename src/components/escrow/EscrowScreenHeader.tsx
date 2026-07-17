'use client';

import Link from 'next/link';
import { IoArrowBack } from 'react-icons/io5';

type Props = {
  title?: string;
  backHref?: string;
  helpHref?: string;
};

export function EscrowScreenHeader({
  title = 'Secure payment',
  backHref,
  helpHref = '/support',
}: Props) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3">
      {backHref ? (
        <Link
          href={backHref}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-white/90 shadow-sm transition hover:bg-[#EDE8FF]/50"
          aria-label="Go back"
        >
          <IoArrowBack size={22} className="text-foreground" />
        </Link>
      ) : (
        <span className="h-11 w-11 shrink-0" aria-hidden />
      )}
      <h1 className="min-w-0 flex-1 truncate text-center font-display text-[17px] font-extrabold tracking-tight text-foreground">
        {title}
      </h1>
      <Link
        href={helpHref}
        className="shrink-0 rounded-2xl border border-primary/20 bg-white/90 px-3.5 py-2.5 text-[13px] font-extrabold text-primary shadow-sm transition hover:bg-[#EDE8FF]/50"
      >
        Help
      </Link>
    </header>
  );
}
