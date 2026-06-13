import type { IconType } from 'react-icons';
import {
  IoArrowDown,
  IoArrowUp,
  IoCard,
  IoCheckmarkCircle,
  IoCloseCircle,
  IoInformationCircle,
  IoSparkles,
  IoTimeOutline,
  IoWarning,
} from 'react-icons/io5';

/** Icon for notification list rows — extend as new event types ship. */
export function notificationIcon(type: string): IconType {
  switch (type) {
    case 'credit_issued':
    case 'trial_started':
      return IoSparkles;
    case 'credit_expiring':
    case 'trial_expiring':
    case 'trial_expired':
      return IoTimeOutline;
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
