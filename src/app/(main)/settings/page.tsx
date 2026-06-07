import Link from 'next/link';

export const metadata = { title: 'Settings' };

const LINKS = [
  { href: '/settings/notifications', label: 'Notifications' },
  { href: '/settings/privacy', label: 'Privacy' },
  { href: '/trust', label: 'Trust & verification' },
  { href: '/support', label: 'Support & safety' },
] as const;

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Settings</h1>
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
