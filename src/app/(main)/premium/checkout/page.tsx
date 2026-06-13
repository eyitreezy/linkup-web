import { redirect } from 'next/navigation';

export default function PremiumCheckoutRedirectPage() {
  redirect('/subscription');
}
