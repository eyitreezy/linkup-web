import { createClient } from '@/lib/supabase/client';
import type { ProfilePreferences } from '@/types/database';

export const DELETION_REASONS = [
  { id: 'met_my_goals', label: 'I found what I was looking for' },
  { id: 'taking_break', label: "I'm taking a break" },
  { id: 'too_many_notifications', label: 'Too many notifications' },
  { id: 'privacy_concerns', label: 'Privacy concerns' },
  { id: 'not_enough_plans', label: 'Not enough meetups near me' },
  { id: 'technical_issues', label: 'Technical issues or bugs' },
  { id: 'other', label: 'Something else' },
] as const;

export type DeletionReasonId = (typeof DELETION_REASONS)[number]['id'];

export async function hideProfileForBreak(userId: string): Promise<{ error?: string }> {
  const client = createClient();
  const { error } = await client.from('profiles').update({ is_profile_public: false }).eq('user_id', userId);
  return error ? { error: error.message } : {};
}

export async function pauseAllNotifications(
  userId: string,
  currentPrefs: ProfilePreferences
): Promise<{ error?: string }> {
  const client = createClient();
  const { error } = await client
    .from('profiles')
    .update({
      preferences: {
        ...currentPrefs,
        notifications: { push: false, email: false },
      },
    })
    .eq('user_id', userId);
  return error ? { error: error.message } : {};
}

export async function suspendAccountWithFeedback(
  userId: string,
  currentPrefs: ProfilePreferences,
  reason: DeletionReasonId,
  otherText?: string
): Promise<{ error?: string }> {
  const client = createClient();
  const feedback = {
    reason,
    ...(reason === 'other' && otherText?.trim() ? { other_text: otherText.trim() } : {}),
    submitted_at: new Date().toISOString(),
  };

  const { error: userError } = await client
    .from('users')
    .update({ account_status: 'suspended', subscription_status: 'expired' })
    .eq('id', userId);
  if (userError) return { error: userError.message };

  const { error: profileError } = await client
    .from('profiles')
    .update({
      is_profile_public: false,
      preferences: {
        ...currentPrefs,
        account_deletion_feedback: feedback,
      },
    })
    .eq('user_id', userId);
  if (profileError) return { error: profileError.message };

  return {};
}
