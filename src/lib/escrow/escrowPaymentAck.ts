const ACK_PREFIX = 'linkup_escrow_payment_ack_';

export function escrowPaymentAckKey(escrowId: string): string {
  return `${ACK_PREFIX}${escrowId}`;
}

export function hasEscrowPaymentAck(escrowId: string): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  return sessionStorage.getItem(escrowPaymentAckKey(escrowId)) === '1';
}

export function markEscrowPaymentAck(escrowId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(escrowPaymentAckKey(escrowId), '1');
}

export function clearEscrowPaymentAck(escrowId: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(escrowPaymentAckKey(escrowId));
}
