'use server';
import { requestIp } from '@/lib/request-ip';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireAdmin, adminLocale } from '@/lib/admin-auth';
import { signIn } from '@/lib/auth';
import { limitMagicLink } from '@/lib/ratelimit';
import { actionError } from '@/lib/api-error';
import {
  listUsers,
  getUser,
  setPlan,
  setConfig,
  moderateFeedback,
  stats,
} from '@/lib/admin-service';
import {
  listKu,
  getKu,
  validateKu,
  previewKu,
  saveKuDraft,
  publishRelease,
  refreshRelease,
} from '@/lib/admin-knowledge';
import { fixtures } from '@/lib/admin-fixtures';
import { siteConfig } from '@/lib/site-config';
import { softDeleteAccount } from '@/lib/account-service';
import { emailUserExport } from '@/lib/admin-export';
import { getDb } from '@/lib/db';
const id = z.string().min(1).max(160);
export type AdminState = { ok?: boolean; code?: string };
async function run<T>(work: (adminId: string) => Promise<T>) {
  const admin = await requireAdmin();
  try {
    const data = await work(admin.id);
    revalidatePath('/admin', 'layout');
    return { ok: true as const, data };
  } catch (error) {
    return { ok: false as const, code: actionError(error) };
  }
}
/** Bounded admin.listUsers API. */
export async function listUsersAction(search: string, page = 1) {
  return run(() =>
    listUsers(z.string().max(160).parse(search), z.number().int().min(1).max(10000).parse(page)),
  );
}
/** Safe admin.getUser API. */
export async function getUserAction(userId: string) {
  return run(() => getUser(id.parse(userId)));
}
/** Audited admin.setPlan form action. */
export async function setPlanAction(_state: AdminState, form: FormData): Promise<AdminState> {
  return run((admin) =>
    setPlan(admin, id.parse(form.get('id')), z.enum(['free', 'pro']).parse(form.get('plan'))),
  );
}
/** Audited admin.softDeleteUser form action; cancellation/revocation use the existing account service. */
export async function softDeleteUserAction(
  _state: AdminState,
  form: FormData,
): Promise<AdminState> {
  return run((admin) => softDeleteAccount(id.parse(form.get('id')), false, admin));
}
/** Send an owner's export link without returning its token or decrypted data. */
export async function emailUserExportAction(
  _state: AdminState,
  form: FormData,
): Promise<AdminState> {
  return run((admin) => emailUserExport(admin, id.parse(form.get('id'))));
}
/** admin.listKu API. */
export async function listKuAction() {
  return run(() => listKu());
}
/** admin.getKu API. */
export async function getKuAction(unitId: string) {
  return run(() => getKu(id.parse(unitId)));
}
/** Reuse CI validation on every editor change. */
export async function validateKuAction(yaml: string) {
  return run(() => validateKu(z.string().max(100000).parse(yaml)));
}
/** Append the next immutable draft revision under optimistic concurrency. */
export async function saveKuDraftAction(yaml: string, unitId: string, baseVersion: number) {
  return run((admin) =>
    saveKuDraft(
      admin,
      z.string().max(100000).parse(yaml),
      id.parse(unitId),
      z.number().int().positive().parse(baseVersion),
    ),
  );
}
/** admin.previewKu API, with A–G selection. */
export async function previewKuAction(yaml: string, fixture: string) {
  return run(() => previewKu(z.string().max(100000).parse(yaml), z.enum(fixtures).parse(fixture)));
}
/** Preflight/publish/rollback use the same candidate validation; no client assertion can bypass it. */
export async function publishReleaseAction(raw: unknown) {
  return run(async (admin) => {
    const input = z
      .object({
        notes: z.string().trim().max(2000),
        draftIds: z
          .array(id)
          .max(1000)
          .refine((v) => new Set(v).size === v.length),
        rollback: z.string().max(80).optional(),
        dryRun: z.boolean(),
      })
      .strict()
      .refine((value) => value.dryRun || value.notes.length > 0)
      .parse(raw);
    const result = await publishRelease(
      admin,
      input.notes,
      input.draftIds,
      input.rollback,
      input.dryRun,
    );
    if (result.version) await refreshRelease(result.version);
    return result;
  });
}
/** admin.getConfig API. */
export async function getConfigAction() {
  return run(() => siteConfig());
}
/** Validate all config fields, then commit config and audit atomically. */
export async function setConfigAction(raw: unknown) {
  return run(async (admin) => {
    await setConfig(admin, raw);
    revalidatePath('/[locale]', 'layout');
    revalidatePath('/zh');
    revalidatePath('/en');
  });
}
/** admin.stats API with the documented day windows. */
export async function statsAction(range: number) {
  return run(() => stats(z.union([z.literal(1), z.literal(7), z.literal(30)]).parse(range)));
}
/** Private feedback list API. */
export async function listFeedbackAction() {
  return run(() => getDb().feedback.findMany({ take: 100, orderBy: { createdAt: 'desc' } }));
}
/** Remove feedback text without retaining it in audit diffs. */
export async function deleteFeedbackTextAction(
  _state: AdminState,
  form: FormData,
): Promise<AdminState> {
  return run((admin) => moderateFeedback(admin, id.parse(form.get('id')), 'delete'));
}
/** Record a processed marker on a feedback entry. */
export async function processFeedbackAction(
  _state: AdminState,
  form: FormData,
): Promise<AdminState> {
  return run((admin) => moderateFeedback(admin, id.parse(form.get('id')), 'process'));
}
/** Switch the dedicated admin locale and record the preference change. */
export async function adminLanguageAction(form: FormData) {
  const admin = await requireAdmin(false);
  const locale = z.enum(['zh', 'en']).parse(form.get('locale'));
  await getDb().adminAuditLog.create({
    data: { adminId: admin.id, action: 'admin.locale', diff: { locale } },
  });
  (await cookies()).set('admin_locale', locale, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/admin',
  });
  revalidatePath('/admin', 'layout');
}
/** Re-auth sends only to the signed-in allowlisted administrator and uses normal Auth.js verification. */
export async function reauthEmailAction(): Promise<AdminState> {
  const admin = await requireAdmin(false);
  try {
    if (!admin.email) throw new Error('Email required');
    await limitMagicLink(admin.email, requestIp(await headers()));
    (await cookies()).set('NEXT_LOCALE', await adminLocale(), { path: '/', sameSite: 'lax' });
    const target: unknown = await signIn('resend', {
      email: admin.email,
      redirect: false,
      redirectTo: '/admin',
    });
    if (typeof target !== 'string' || new URL(target, 'http://localhost').searchParams.has('error'))
      throw new Error('Re-auth delivery failed');
    await getDb().adminAuditLog.create({
      data: { adminId: admin.id, action: 'admin.reauth_requested' },
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, code: actionError(error) };
  }
}
/** Force a new Google authorization flow and a newly created database session. */
export async function reauthGoogleAction() {
  const admin = await requireAdmin(false);
  const jar = await cookies();
  const token =
    jar.get('__Secure-authjs.session-token')?.value ?? jar.get('authjs.session-token')?.value;
  // DESIGN-GAP: Auth.js can reuse an existing OAuth session; revoke only this requesting session before re-auth so a verified callback must create a fresh one.
  await getDb().$transaction(async (tx) => {
    if (token) await tx.session.deleteMany({ where: { sessionToken: token, userId: admin.id } });
    await tx.adminAuditLog.create({
      data: { adminId: admin.id, action: 'admin.reauth_requested', diff: { provider: 'google' } },
    });
  });
  await signIn('google', { redirectTo: '/admin' }, { prompt: 'select_account', max_age: '0' });
}
