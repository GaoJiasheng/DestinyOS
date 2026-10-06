import { fromDbLocale } from './db-locale';
import { createHash, randomBytes } from 'node:crypto';
import { Resend } from 'resend';
import { createTranslator } from 'next-intl';
import { getDb } from './db';
import { reserveExport } from './account-service';

import { stateWrite, stateRelease } from './state';
import { toMessages } from '@/i18n/catalog';
import zh from '@/messages/zh.json';
import tw from '../messages/zh-TW.json';
import en from '@/messages/en.json';
import { brand } from '@tianji/shared';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
/** Mail a fifteen-minute, single-use export link directly to the account owner; never return the token to the admin. */
export async function emailUserExport(adminId: string, userId: string) {
  const user = await getDb().user.findUniqueOrThrow({
    where: { id: userId },
    select: { email: true, locale: true, deletedAt: true },
  });
  if (!user.email || user.deletedAt) throw new Error('Active email required');
  await reserveExport(userId);
  const token = randomBytes(32).toString('base64url');
  await stateWrite(`admin:export:${digest(token)}`, JSON.stringify({ userId }), 900);
  await getDb().adminAuditLog.create({
    data: { adminId, action: 'user.export_email', target: userId },
  });
  const t = createTranslator({
    locale: fromDbLocale(user.locale),
    messages: toMessages(user.locale === 'zh-TW' ? tw : user.locale === 'zh' ? zh : en),
  });
  const url = `${process.env.NEXT_PUBLIC_SITE_URL ?? `https://${brand.domain}`}/api/v1/admin/export/${token}`;
  const result = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: process.env.EMAIL_FROM ?? '',
    to: user.email,
    subject: t('admin.export.subject'),
    text: t('admin.export.body', { url }),
    html: `<p>${t('admin.export.description')}</p><a href="${url}">${t('admin.export.download')}</a>`,
  });
  if (result.error) throw new Error('Export email failed');
}
/** Consume the token only when the authenticated owner matches; admins cannot download another owner's data. */
export async function consumeExport(token: string, userId: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return false;
  const key = `admin:export:${digest(token)}`;
  // DESIGN-GAP: Require the recipient's session as well as the email bearer token; failed owner checks leave the link intact.
  return stateRelease(key, JSON.stringify({ userId }));
}
