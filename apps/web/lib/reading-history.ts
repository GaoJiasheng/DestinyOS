import { z } from 'zod';
import { getLocale } from 'next-intl/server';
import { localeText } from '@tianji/shared/locale';
import { System } from '@tianji/shared';
import { getDb } from './db';
import { ApiError } from './api-error';
import { currentProfile } from './profile-service';
import { ReportSchema } from './reading-schema';
import { idSchema, userId, run } from './reading-action-context';
/** Paginate owner-only history, excluding encrypted inputs and full chart/report payloads. */
export async function listReadingHistory(raw: unknown = { limit: 20 }) {
  return run(async () => {
    const owner = await userId();
    const input = z
      .object({
        system: z.nativeEnum(System).optional(),
        cursor: idSchema.optional(),
        // DESIGN-GAP: Title search is a bounded optional argument for the documented history search UI.
        search: z.string().trim().max(120).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      })
      .strict()
      .parse(raw);
    if (
      input.cursor &&
      !(await getDb().reading.findFirst({ where: { id: input.cursor, userId: owner } }))
    )
      throw new ApiError('E_NOT_FOUND', 'Cursor not found', 404);
    const plan = await getDb().user.findUniqueOrThrow({
      where: { id: owner },
      select: { plan: true },
    });
    const recent =
      plan.plan === 'free'
        ? await getDb().reading.findMany({
            where: { userId: owner },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 50,
            select: { id: true },
          })
        : null;
    const selected = await currentProfile(owner);
    const rows = await getDb().reading.findMany({
      where: {
        userId: owner,
        system: input.system,
        // DESIGN-GAP: Legacy divination and anonymous imports without a profile remain visible in owner history.
        ...(selected
          ? {
              OR: [
                { profileId: selected.id },
                { partnerProfileId: selected.id },
                { profileId: null },
              ],
            }
          : { profileId: null }),
        ...(recent ? { id: { in: recent.map((r) => r.id) } } : {}),
        ...(input.search ? { title: { contains: input.search } } : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: input.cursor ? { id: input.cursor } : undefined,
      skip: input.cursor ? 1 : 0,
      take: input.limit + 1,
      select: {
        id: true,
        title: true,
        system: true,
        createdAt: true,
        reportZh: true,
        reportEn: true,
      },
    });
    const locale = await getLocale();
    const more = rows.length > input.limit;
    const visible = rows.slice(0, input.limit);
    return {
      items: visible.map((row) => {
        const report = ReportSchema.safeParse(
          locale === 'en' ? (row.reportEn ?? row.reportZh) : (row.reportZh ?? row.reportEn),
        );
        return {
          id: row.id,
          title: row.title,
          system: row.system,
          createdAt: row.createdAt.toISOString(),
          keywords: report.success
            ? report.data.headline.keywords.map((text) =>
                locale === 'zh-TW' ? localeText(text, 'zh-TW') : text,
              )
            : [],
        };
      }),
      nextCursor: more ? visible.at(-1)?.id : null,
    };
  });
}
