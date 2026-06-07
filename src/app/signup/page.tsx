import { AuthShell } from '@/components/auth/AuthShell';
import { SignupForm } from '@/features/auth/SignupForm';

export const metadata = { title: 'Create account' };

export default function SignupPage() {
  return (
    <AuthShell
      title="Join LinkUp"
      subtitle="Trusted plans, real people, same experience as the app."
      showModeToggle
    >
      <SignupForm />
    </AuthShell>
  );
}
