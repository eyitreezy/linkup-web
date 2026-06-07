import { cn } from '@/utils/cn';
import type { ReactNode } from 'react';

export function FormCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-3xl p-[2px] linkup-gradient-primary shadow-md', className)}>
      <div className="rounded-[22px] bg-white p-5">{children}</div>
    </div>
  );
}
