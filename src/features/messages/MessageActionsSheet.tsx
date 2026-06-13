'use client';

import { cn } from '@/utils/cn';
import type { IconType } from 'react-icons';
import {
  IoArrowRedoOutline,
  IoArrowUndoOutline,
  IoCopyOutline,
  IoCreateOutline,
  IoEyeOffOutline,
  IoEyeOutline,
  IoPin,
  IoPinOutline,
  IoTrashOutline,
} from 'react-icons/io5';

export type MessageActionItem = {
  key: string;
  label: string;
  icon: IconType;
  destructive?: boolean;
  onPress: () => void;
};

type Props = {
  open: boolean;
  onClose: () => void;
  actions: MessageActionItem[];
};

export function MessageActionsSheet({ open, onClose, actions }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/40 p-3 backdrop-blur-sm min-[425px]:items-center min-[425px]:p-4"
      onClick={onClose}
    >
      <div
        className="linkup-card w-full max-w-sm overflow-hidden rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mt-3 h-1 w-10 rounded-full bg-border" aria-hidden />
        <ul className="divide-y divide-border/80 py-1">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <li key={action.key}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    action.onPress();
                  }}
                  className={cn(
                    'flex w-full items-center gap-3 px-5 py-3.5 text-left text-[15px] font-extrabold transition hover:bg-[#F8F7FF]',
                    action.destructive ? 'text-red-600' : 'text-foreground'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full',
                      action.destructive ? 'bg-red-50 text-red-600' : 'bg-[#EDE8FF] text-primary'
                    )}
                  >
                    <Icon size={20} />
                  </span>
                  {action.label}
                </button>
              </li>
            );
          })}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="w-full border-t border-border py-3.5 text-[15px] font-extrabold text-muted"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export const MESSAGE_ACTION_ICONS = {
  reply: IoArrowUndoOutline,
  copy: IoCopyOutline,
  forward: IoArrowRedoOutline,
  edit: IoCreateOutline,
  pin: IoPinOutline,
  unpin: IoPin,
  delete: IoTrashOutline,
  hideReceipt: IoEyeOffOutline,
  showReceipt: IoEyeOutline,
};
