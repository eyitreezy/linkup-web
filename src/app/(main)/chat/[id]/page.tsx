import { redirect } from 'next/navigation';

type Props = { params: Promise<{ id: string }> };

export default async function ChatPage({ params }: Props) {
  const { id } = await params;
  redirect(`/messages?c=${id}`);
}
