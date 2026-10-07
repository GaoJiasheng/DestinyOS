import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { featureMessages } from '@/i18n/feature-messages';
/** Load the feature catalog at its route boundary rather than every app navigation. */
export async function FeatureMessages({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  return (
    <NextIntlClientProvider messages={featureMessages(await getMessages({ locale }))}>
      {children}
    </NextIntlClientProvider>
  );
}
