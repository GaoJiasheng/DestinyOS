import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { dailyMessages, featureMessages } from '@/i18n/feature-messages';
import { toMessages } from '@/i18n/catalog';
/** Keep illustrated card prose out of the global shell; the daily view only shows the card name and orientation. */
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
      ? Object.fromEntries(Object.entries(catalog).filter(([key]) => /\.name$/.test(key)))
      : catalog,
  );
  const messages = await getMessages();
  const scopedBase = daily ? dailyMessages(messages) : featureMessages(messages);
  return (
    <NextIntlClientProvider
      messages={{
        ...scopedBase,
        tarot: {
          // DESIGN-GAP: Daily omits spread positions and ritual help (~7KB Flight); dailyMessages already keeps upright/reversed.
          ...((daily ? scopedBase.tarot : messages.tarot) as object | undefined),
          ...(typeof scoped.tarot === 'object' ? scoped.tarot : {}),
        },
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
