import { cn } from '@/utils/cn';

type Props = {
  className?: string;
  size?: number;
};

/** Heart inside ring — MatchMaker tab icon. */
export function MatchMakerTabIcon({ className, size = 24 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      className={cn('shrink-0', className)}
      aria-hidden
    >
      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="2.5" fill="none" />
      <path
        d="M24 33s-9-6.5-9-12.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3C33 26.5 24 33 24 33z"
        fill="currentColor"
      />
    </svg>
  );
}
