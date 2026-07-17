import {
  APP_LOGO_HEIGHT,
  APP_LOGO_PATH,
  APP_LOGO_WIDTH,
  APP_NAME,
} from '@/lib/brand';
import { cn } from '@/utils/cn';

type Props = {
  width?: number;
  className?: string;
  priority?: boolean;
  /** Set when a parent lockup already exposes `aria-label`. */
  decorative?: boolean;
};

/** Shared LinkUp wordmark — transparent PNG, no blend modes. */
export function LinkUpLogo({
  width = 160,
  className,
  priority = false,
  decorative = false,
}: Props) {
  const height = Math.round(width * (APP_LOGO_HEIGHT / APP_LOGO_WIDTH));

  return (
    <img
      src={APP_LOGO_PATH}
      alt={decorative ? '' : APP_NAME}
      width={width}
      height={height}
      className={cn('block object-contain', className)}
      style={{ width, height }}
      decoding={priority ? 'sync' : 'async'}
      fetchPriority={priority ? 'high' : undefined}
    />
  );
}
