'use client';

import { ChatToolbar } from '@/features/messages/ChatToolbar';
import { ReplyPreviewBar } from '@/features/messages/ReplyPreviewBar';
import { MessageComposer, type MessageComposerLook } from '@/features/messages/MessageComposer';
import { useIsMobileShellLayout } from '@/hooks/use-media-query';
import type { ChatAppearancePreset } from '@/lib/messaging/chatAppearance';
import { cn } from '@/utils/cn';
import type { ReactNode, RefObject } from 'react';
import { useRef, useState } from 'react';
import { IoAdd, IoClose } from 'react-icons/io5';

type Props = {
  preset: ChatAppearancePreset;
  onOffer: () => void;
  onPlace: () => void;
  placeBusy?: boolean;
  onLiveLocation?: () => void;
  liveLocationActive?: boolean;
  liveLocationBusy?: boolean;
  showLiveLocation?: boolean;
  liveLocationOverlays?: ReactNode;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onAttach: (file: File) => void;
  sending: boolean;
  disabled?: boolean;
  threadLook?: MessageComposerLook | null;
  replyTo?: { senderLabel: string; preview: string } | null;
  onCancelReply?: () => void;
  composeInputRef?: RefObject<HTMLTextAreaElement | null>;
  mentionPicker?: ReactNode;
  placeholder?: string;
  onSelectionChange?: (start: number, end: number) => void;
};

export function ChatComposer({
  preset,
  onOffer,
  onPlace,
  placeBusy,
  onLiveLocation,
  liveLocationActive,
  liveLocationBusy,
  showLiveLocation,
  liveLocationOverlays,
  value,
  onChange,
  onSend,
  onAttach,
  sending,
  disabled,
  threadLook,
  replyTo,
  onCancelReply,
  composeInputRef,
  mentionPicker,
  placeholder,
  onSelectionChange,
}: Props) {
  const isMobile = useIsMobileShellLayout();
  const [toolsOpen, setToolsOpen] = useState(false);
  const attachColor = threadLook?.attachIcon ?? preset.composerAttachIcon;
  const fileRef = useRef<HTMLInputElement>(null);

  function openAttachPicker() {
    fileRef.current?.click();
  }

  function closeTools() {
    setToolsOpen(false);
  }

  return (
    <div className="w-full min-w-0">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            onAttach(file);
            closeTools();
          }
          e.target.value = '';
        }}
      />
      {replyTo && onCancelReply ? (
        <ReplyPreviewBar
          senderLabel={replyTo.senderLabel}
          preview={replyTo.preview}
          onCancel={onCancelReply}
        />
      ) : null}
      {mentionPicker}

      {toolsOpen ? (
        <>
          {liveLocationOverlays}
          <ChatToolbar
            preset={preset}
            onOffer={() => {
              onOffer();
              closeTools();
            }}
            onPlace={() => {
              void onPlace();
              closeTools();
            }}
            placeBusy={placeBusy}
            onAttach={openAttachPicker}
            onLiveLocation={onLiveLocation}
            liveLocationActive={liveLocationActive}
            liveLocationBusy={liveLocationBusy}
            showLiveLocation={showLiveLocation}
            variant="compact"
            className="border-b border-border/60"
          />
        </>
      ) : null}

      <MessageComposer
        value={value}
        onChange={onChange}
        onSend={onSend}
        onAttach={onAttach}
        sending={sending}
        disabled={disabled}
        threadLook={threadLook}
        compact={isMobile}
        leadingSlot={
          <button
            type="button"
            onClick={() => setToolsOpen((o) => !o)}
            className={cn(
              'mb-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition min-[360px]:h-10 min-[360px]:w-10',
              toolsOpen ? 'bg-primary/10 text-primary' : 'text-muted hover:bg-black/5'
            )}
            style={{ color: toolsOpen ? undefined : attachColor }}
            aria-label={toolsOpen ? 'Hide actions' : 'Show plan, offer, and place actions'}
            aria-expanded={toolsOpen}
          >
            {toolsOpen ? <IoClose size={24} /> : <IoAdd size={26} />}
          </button>
        }
        hideAttachButton
        inputRef={composeInputRef}
        placeholder={placeholder}
        onSelectionChange={onSelectionChange}
      />
    </div>
  );
}
