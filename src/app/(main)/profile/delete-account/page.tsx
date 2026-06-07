import Link from 'next/link';

export const metadata = { title: 'Delete account' };

export default function DeleteAccountPage() {
  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Delete account</h1>
        <p className="mt-1 text-[14px] font-semibold text-muted">
          Account deletion flows through the same safeguards as mobile. Contact support if you need help closing
          your account immediately.
        </p>
      </header>
      <Link
        href="/support"
        className="inline-flex min-h-[48px] items-center rounded-full linkup-gradient-primary px-6 text-[14px] font-extrabold text-white"
      >
        Contact support
      </Link>
      <Link href="/profile" className="ml-4 font-extrabold text-primary underline">
        Back to profile
      </Link>
    </div>
  );
}
