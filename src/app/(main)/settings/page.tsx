import Link from 'next/link';
import { getServerAuthUser } from '@/lib/auth/server-session';
import { maskAccountNumber } from '@/lib/escrow/virtualAccountPayment';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/env';

export const metadata = { title: 'Settings' };

const LINKS = [
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/trust', label: 'Trust & verification' },
  { href: '/support', label: 'Support & safety' },
] as const;

export default async function SettingsPage() {
  let refundSummary: string | null = null;

  if (isSupabaseConfigured) {
    const user = await getServerAuthUser();
    if (user) {
      const supabase = await createClient();
      const { data: account } = await supabase
        .from('user_payment_accounts')
        .select('bank_name, account_number, account_name')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();
      if (account) {
        refundSummary = `${account.bank_name} · ${maskAccountNumber(account.account_number)} · ${account.account_name}`;
      }
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>

      <section className="space-y-2">
        <h2 className="text-[12px] font-extrabold uppercase tracking-wide text-muted">Payment and refunds</h2>
        <div className="linkup-card divide-y divide-border">
          {refundSummary ? (
            <>
              <div className="px-4 py-3.5">
                <p className="text-[15px] font-extrabold text-foreground">Refund account</p>
                <p className="mt-1 text-[13px] font-semibold text-muted">{refundSummary}</p>
                <div className="mt-3 flex gap-4">
                  <Link
                    href="/settings/refund-account"
                    className="text-[14px] font-extrabold text-primary underline-offset-2 hover:underline"
                  >
                    Update
                  </Link>
                  <Link
                    href="/settings/refund-account"
                    className="text-[14px] font-extrabold text-[#EF4444] underline-offset-2 hover:underline"
                  >
                    Remove
                  </Link>
                </div>
              </div>
            </>
          ) : (
            <Link
              href="/settings/refund-account"
              className="flex px-4 py-3.5 text-[15px] font-bold text-primary hover:bg-[#F8F7FF]"
            >
              Add refund account
            </Link>
          )}
        </div>
      </section>

      <nav className="linkup-card divide-y divide-border">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="flex px-4 py-3.5 text-[15px] font-bold text-foreground hover:bg-[#F8F7FF]"
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
