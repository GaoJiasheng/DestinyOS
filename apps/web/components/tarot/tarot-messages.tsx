import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { toMessages } from '@/i18n/catalog';
/** Keep illustrated card prose out of the global shell; daily cards only need names, keywords and advice. */
export async function TarotMessages({
  children,
  daily = false,
}: {
  children: ReactNode;
  daily?: boolean;
}) {
  const locale = await getLocale();
  const catalog =
    locale === 'zh-TW'
      ? (await import('@/messages/zh-TW/tarot.json')).default
      : locale === 'en'
        ? (await import('@/messages/en/tarot.json')).default
        : (await import('@/messages/zh/tarot.json')).default;
  const scoped = toMessages(
    daily
      ? Object.fromEntries(
          Object.entries(catalog).filter(([key]) =>
            /\.(name|advice|keywordsUpright|keywordsReversed)$/.test(key),
          ),
        )
      : catalog,
  );
  const messages = await getMessages();
  return (
    <NextIntlClientProvider
      messages={{
        ...messages,
        tarot: {
          ...(typeof messages.tarot === 'object' ? messages.tarot : {}),
          ...(typeof scoped.tarot === 'object' ? scoped.tarot : {}),
        },
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
