import type { IconType } from 'react-icons';
import {
  IoArrowDown,
  IoArrowUp,
  IoCard,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoGridOutline,
  IoInformationCircle,
  IoSparkles,
  IoSwapHorizontal,
  IoPricetag,
  IoTimeOutline,
  IoWarning,
} from 'react-icons/io5';

/** Icon for notification list rows — extend as new event types ship. */
export function notificationIcon(type: string): IconType {
  switch (type) {
    case 'offer_received':
      return IoPricetag;
    case 'offer_countered':
      return IoSwapHorizontal;
    case 'offer_accepted':
      return IoCheckmarkCircle;
    case 'offer_declined':
      return IoCloseCircle;
    case 'credit_issued':
    case 'trial_started':
      return IoSparkles;
    case 'credit_expiring':
    case 'trial_expiring':
    case 'trial_expired':
      return IoTimeOutline;
    case 'meet_type_submitted':
      return IoGridOutline;
    case 'meet_type_approved':
      return IoCheckmarkCircle;
    case 'meet_type_rejected':
      return IoCloseCircle;
    default:
      return IoSparkles;
  }
}

export function subscriptionEventIcon(eventType: string): IconType {
  if (eventType.startsWith('trial_') || eventType.startsWith('admin_trial_')) return IoSparkles;
  if (eventType === 'payment_failed') return IoWarning;
  if (eventType === 'payment_succeeded') return IoCheckmarkCircle;
  if (eventType === 'subscription_upgraded') return IoArrowUp;
  if (eventType === 'subscription_downgraded') return IoArrowDown;
  if (eventType === 'subscription_cancelled') return IoCloseCircle;
  if (eventType.startsWith('subscription_') || eventType.startsWith('payment_')) return IoCard;
  return IoInformationCircle;
}
