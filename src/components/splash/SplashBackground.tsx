import { APP_SPLASH_BACKGROUND } from '@/lib/brand';

/** Solid branded splash backdrop. */
export function SplashBackground({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative flex h-full min-h-full w-full flex-1 flex-col overflow-hidden"
      style={{ backgroundColor: APP_SPLASH_BACKGROUND }}
    >
      {children}
    </div>
  );
}
