'use client';
import { MessageCircle } from 'lucide-react';
import { useCopy } from '@/i18n/use-copy';

/** Prominent jump from the one-page summary to the follow-up chat at the end of the report.
 * The chat panel keeps its own availability rules: signed-out readers see its sign-in invitation. */
export function ChatEntry() {
  const t = useCopy();
  return (
    <a
      className="button button-secondary chat-entry"
      href="#report-chat"
      onClick={() => {
        const panel = document.getElementById('report-chat');
        if (panel instanceof HTMLDetailsElement) panel.open = true;
      }}
    >
      <MessageCircle aria-hidden="true" size={16} />
      {t('report.chat.ask')}
    </a>
  );
}
