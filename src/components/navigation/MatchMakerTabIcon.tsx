'use client';

type Props = {
  size?: number;
  color?: string;
  active?: boolean;
  className?: string;
};

/** Heart with elliptical orbital ring — MatchMaker tab icon. */
export function MatchMakerTabIcon({
  size = 24,
  color = 'currentColor',
  active = false,
  className,
}: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M4.5 12.8C4.5 14.5 7.8 16 12 16C16.2 16 19.5 14.5 19.5 12.8"
        stroke={color}
        strokeWidth={active ? 2 : 1.5}
        strokeLinecap="round"
        opacity={0.35}
      />
      <path
        d="M12 19C12 19 4.5 14 4.5 8.5C4.5 6.3 6.1 4.5 8.1 4.5C9.5 4.5 10.8 5.3 12 6.5C13.2 5.3 14.5 4.5 15.9 4.5C17.9 4.5 19.5 6.3 19.5 8.5C19.5 14 12 19 12 19Z"
        stroke={color}
        strokeWidth={active ? 2 : 1.5}
        strokeLinejoin="round"
        fill={active ? color : 'none'}
        fillOpacity={active ? 0.15 : 0}
      />
      <path
        d="M19.5 12.8C19.5 11.1 16.2 9.6 12 9.6C7.8 9.6 4.5 11.1 4.5 12.8"
        stroke={color}
        strokeWidth={active ? 2 : 1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
