import { redirect } from 'next/navigation';

export default function PremiumSuccessRedirectPage() {
  redirect('/subscription');
}
