import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

type Props = {
  children: ReactNode;
  className?: string;
};

/** Glass form container — mobile auth (app AuthGlassCard parity). */
export function AuthGlassCard({ children, className }: Props) {
  return (
    <div className={cn('auth-glass-card', className)}>
      <div className="auth-glass-card-inner">{children}</div>
    </div>
  );
}
