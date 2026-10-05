import { localeText } from '@tianji/shared/locale';
import { createTranslator } from 'next-intl';
import { Resend } from 'resend';
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

/** Send a Resend email; tests can supply a loopback mail sink without contacting external recipients. */
export async function sendMagicEmail(
  email: string,
  locale: 'zh' | 'en' | 'zh-TW',
  url: string,
): Promise<void> {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error('EMAIL_FROM is required');
  const payload = { from, to: email, ...magicLinkEmail(locale, url) };
  // DESIGN-GAP: A loopback-only mail sink enables E2E with no third-party credentials; production ignores it.
  if (process.env.NODE_ENV !== 'production' && process.env.TEST_MAIL_URL) {
    const endpoint = new URL(process.env.TEST_MAIL_URL);
    if (endpoint.hostname !== '127.0.0.1') throw new Error('Test mail sink must use loopback');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Test mail delivery failed');
    return;
  }
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send(payload);
  if (result.error) throw new Error('Magic-link delivery failed');
}
