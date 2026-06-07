'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export type AuthMode = 'login' | 'signup';

export function AuthModeToggle() {
  const pathname = usePathname();
  const mode: AuthMode = pathname.startsWith('/signup') ? 'signup' : 'login';

  return (
    <div className="auth-mode-toggle lg:hidden" role="tablist" aria-label="Sign in or sign up">
      <Link
        href="/login"
        role="tab"
        aria-selected={mode === 'login'}
        className={
          mode === 'login'
            ? 'auth-mode-toggle__tab auth-mode-toggle__tab--active'
            : 'auth-mode-toggle__tab auth-mode-toggle__tab--idle'
        }
      >
        Log in
      </Link>
      <Link
        href="/signup"
        role="tab"
        aria-selected={mode === 'signup'}
        className={
          mode === 'signup'
            ? 'auth-mode-toggle__tab auth-mode-toggle__tab--active'
            : 'auth-mode-toggle__tab auth-mode-toggle__tab--idle'
        }
      >
        Sign up
      </Link>
    </div>
  );
}
