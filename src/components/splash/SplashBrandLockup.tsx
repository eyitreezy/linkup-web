import {
  APP_NAME,
  APP_SPLASH_LOCKUP_HEIGHT,
  APP_SPLASH_LOCKUP_PATH,
  APP_SPLASH_LOCKUP_WIDTH,
} from '@/lib/brand';

type Props = {
  lockupWidth?: number;
};

/** Centered splash lockup — transparent wordmark + tagline image. */
export function SplashBrandLockup({ lockupWidth = 320 }: Props) {
  const height = Math.round(lockupWidth * (APP_SPLASH_LOCKUP_HEIGHT / APP_SPLASH_LOCKUP_WIDTH));

  return (
    <div className="flex items-center justify-center" role="img" aria-label={APP_NAME}>
      <img
        src={APP_SPLASH_LOCKUP_PATH}
        alt=""
        width={lockupWidth}
        height={height}
        className="block max-w-[86vw] object-contain"
        style={{ width: lockupWidth, height }}
        decoding="sync"
        fetchPriority="high"
      />
    </div>
  );
}
