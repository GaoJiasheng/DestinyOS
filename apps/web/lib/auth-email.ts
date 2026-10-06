import { localeText } from '@tianji/shared/locale';
import { createTranslator } from 'next-intl';
import { sendEmail } from './platform/email';
import { brand } from '@tianji/shared/brand';
import zh from '../messages/zh.json';
import tw from '../messages/zh-TW.json';
import en from '../messages/en.json';
import { toMessages } from '../i18n/catalog';

function escapeHtml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char,
  );
}

/** Render bilingual magic-link email copy with next-intl; URL always lands on the confirmation page. */
export function magicLinkEmail(locale: 'zh' | 'en' | 'zh-TW', url: string) {
  const t = createTranslator({
    locale,
    messages: toMessages(locale === 'zh-TW' ? tw : locale !== 'en' ? zh : en),
  });
  const name = locale !== 'en' ? localeText(brand.nameZh, locale) : brand.nameEn;
  const subject = t('auth.magic.subject', { brand: name });
  const description = t('auth.magic.description');
  const confirm = t('auth.verify.confirm');
  const ignore = t('auth.magic.ignore');
  return {
    subject,
    text: `${description}\n\n${confirm}: ${url}\n\n${ignore}`,
    html: `<html lang="${locale}"><body><h1>${escapeHtml(subject)}</h1><p>${escapeHtml(description)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(confirm)}</a></p><p>${escapeHtml(ignore)}</p></body></html>`,
  };
}

/** Send the localized magic link through the platform email interface. */
export async function sendMagicEmail(
  email: string,
  locale: 'zh' | 'en' | 'zh-TW',
  url: string,
): Promise<void> {
  await sendEmail({ to: email, ...magicLinkEmail(locale, url) });
}
