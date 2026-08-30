/** Map Supabase RPC errors for group participation to user-facing copy. */
export function formatGroupParticipationError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('already_group_guest')) {
    return 'You are already a guest on this plan.';
  }
  if (m.includes('group_full') || m.includes('no_slots_available')) {
    return 'This group plan has no guest slots available.';
  }
  if (m.includes('opt_out_window_closed')) {
    return 'Opt out is only available more than 48 hours before the meetup.';
  }
  if (m.includes('not_confirmed_guest')) {
    return 'Only confirmed guests can opt out of this plan.';
  }
  if (m.includes('no_matrix_entry_found')) {
    return 'Cancellation terms are not available for this plan yet. Please try again later or contact support.';
  }
  if (m.includes('group_guest_cannot_cancel_plan')) {
    return 'Guests cannot cancel a group plan. Use Opt Out on the plan details screen if you need to leave.';
  }
  if (m.includes('use_group_host_cancellation')) {
    return 'Use the group plan cancellation flow from the agreement screen.';
  }
  if (m.includes('plan_listing_expired')) {
    return 'This plan is no longer accepting new requests.';
  }
  if (m.includes('integer out of range') || m.includes('numeric_value_out_of_range')) {
    return 'We could not complete this action due to a payment calculation issue. Please contact support.';
  }
  return message;
}
