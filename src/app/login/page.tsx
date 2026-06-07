import { AuthShell } from '@/components/auth/AuthShell';
import { LoginForm } from '@/features/auth/LoginForm';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to continue your plans and messages."
      showModeToggle
    >
      <LoginForm />
    </AuthShell>
  );
}
