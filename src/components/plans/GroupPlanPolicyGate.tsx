'use client';

import { GroupPlanPolicyModal } from '@/components/plans/GroupPlanPolicyModal';
import { hasGroupPolicySignoff } from '@/lib/groupPlan/annexureB';
import { useEffect, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** When true, require Group Plan policy sign-off before showing children. */
  active?: boolean;
};

export function GroupPlanPolicyGate({ children, active = true }: Props) {
  const [loading, setLoading] = useState(active);
  const [signed, setSigned] = useState(!active);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    if (!active) {
      setLoading(false);
      setSigned(true);
      setShowModal(false);
      return;
    }
    let cancelled = false;
    void hasGroupPolicySignoff().then((ok) => {
      if (cancelled) return;
      setSigned(ok);
      setShowModal(!ok);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  if (!active) return <>{children}</>;

  if (loading) {
    return (
      <p className="text-[14px] font-semibold text-muted">Loading Group Plan policy…</p>
    );
  }

  if (showModal && !signed) {
    return (
      <GroupPlanPolicyModal
        onSigned={() => {
          setSigned(true);
          setShowModal(false);
        }}
      />
    );
  }

  return <>{children}</>;
}
