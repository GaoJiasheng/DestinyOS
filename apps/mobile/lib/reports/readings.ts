import { z } from 'zod';
import * as Crypto from 'expo-crypto';
import { compute, normalizeBirth, type ComputeInput } from '@tianji/engine';
import { interpret, localizeReport, type Report } from '@tianji/interpret';
import {
  System,
  ReadingRequestSchema,
  EngineErrorCode,
  BaziChartSchema,
  ZiweiChartSchema,
  IchingChartSchema,
  QimenChartSchema,
  TarotChartSchema,
  AstroChartSchema,
  VedicChartSchema,
  NumerologyChartSchema,
  SynastryChartSchema,
  type EngineWarning,
} from '@tianji/shared';
import { getLocalStore } from '../data/store';
import type { LocalReading, LocalRecord, Profile } from '../data/models';
import { getOfflineKnowledge } from '../knowledge';
import type { MobileLocale } from '../i18n';
import type { RitualInput } from '../rituals/model';

export const reportSystems = [
  'bazi',
  'ziwei',
  'iching',
  'qimen',
  'tarot',
  'astrology',
  'vedic',
  'numerology',
  'synastry',
] as const;
export type ReportSystem = (typeof reportSystems)[number];
export const ReportSystemSchema = z.enum(reportSystems);
const chartSchemas = {
  bazi: BaziChartSchema,
  ziwei: ZiweiChartSchema,
  iching: IchingChartSchema,
  qimen: QimenChartSchema,
  tarot: TarotChartSchema,
  astrology: AstroChartSchema,
  vedic: VedicChartSchema,
  numerology: NumerologyChartSchema,
  synastry: SynastryChartSchema,
};
export type NativeChart = {
  [K in ReportSystem]: { system: K; data: z.infer<(typeof chartSchemas)[K]> };
}[ReportSystem];
/** Validate a persisted chart before native drawing; daily reports belong to M08. */
export function parseNativeChart(system: ReportSystem, chart: unknown): NativeChart {
  // DESIGN-GAP: Zod's schema map loses the key/result correlation at dynamic dispatch;
  // each entry is validated before restoring the discriminated union.
  return { system, data: chartSchemas[system].parse(chart) } as NativeChart;
}
export interface NativeReading {
  record: LocalRecord<LocalReading>;
  chart: NativeChart;
  report: Report;
  warnings: EngineWarning[];
  stale: boolean;
}
function optionsFor(system: ReportSystem, profile?: Profile) {
  const school = profile?.options?.school;
  if (!school) return undefined;
  if (system === 'bazi')
    return { school: { ziHour: school.ziHour, useApparentSolarTime: school.useApparentSolarTime } };
  if (system === 'ziwei') return { school: { leapMonth: school.leapMonth } };
  if (system === 'astrology') return { school: { houseSystem: school.houseSystem } };
  return undefined;
}
/** Create a complete bilingual offline snapshot, then persist only through SQLCipher. */
export async function createNativeReading(
  system: ReportSystem,
  profile: LocalRecord<Profile> | null,
  partner?: LocalRecord<Profile>,
  now = new Date().toISOString(),
  seed?: string,
  ritual?: RitualInput,
  id = Crypto.randomUUID(),
) {
  const birth = profile?.data?.birth;
  const request = ReadingRequestSchema.parse({
    system,
    birth,
    partnerBirth: partner?.data?.birth,
    profileId: profile?.id,
    partnerProfileId: partner?.id,
    partnerProfileVersion: partner?.data?.version,
    displayName: profile?.data?.name,
    options: optionsFor(system, profile?.data ?? undefined),
    ...ritual,
    seed: seed ?? id,
    idempotencyKey: id,
  });
  const input: ComputeInput = {
    system,
    now,
    seed: seed ?? id,
    birth: birth ? normalizeBirth(birth) : null,
    partnerBirth: partner?.data ? normalizeBirth(partner.data.birth) : undefined,
    options: request.options,
    ...ritual,
  };
  const result = compute(input);
  const knowledge = await getOfflineKnowledge(system);
  const reports = (['zh', 'en'] as const).map((locale) =>
    interpret({
      system,
      chart: result.chart,
      locale,
      knowledge,
      context: { now, profileHasTime: !birth?.timeUnknown, engineVersion: result.engineVersion },
    }),
  );
  const snapshot: LocalReading = {
    profileId: profile?.id ?? null,
    profileVersion: profile?.data?.version ?? null,
    system,
    status: 'ok',
    inputSnapshot: request,
    chart: result.chart,
    reportZh: { ...reports[0]! },
    reportEn: { ...reports[1]! },
    schoolUsed: result.meta.schoolUsed,
    meta: result.meta,
    engineVersion: result.engineVersion,
    interpretVersion: reports[0]!.interpretVersion,
    knowledgeVersion: knowledge.knowledgeVersion,
    title: null,
    isPublic: false,
  };
  return (await getLocalStore()).readings.save(snapshot, id);
}

/** Structural guard for the typed, encrypted report payload; never render malformed records. */
function isReport(raw: unknown): raw is Report {
  if (!raw || typeof raw !== 'object') return false;
  const value = raw as Partial<Report>;
  return Boolean(
    Object.values(System).includes(value.system as System) &&
    ['zh', 'en', 'zh-TW'].includes(value.locale ?? '') &&
    typeof value.knowledgeVersion === 'string' &&
    typeof value.engineVersion === 'string' &&
    typeof value.interpretVersion === 'string' &&
    value.headline &&
    typeof value.headline.persona === 'string' &&
    Array.isArray(value.headline.keywords) &&
    value.headline.keywords.every((v) => typeof v === 'string') &&
    typeof value.headline.confidence === 'number' &&
    value.headline.confidence >= 0 &&
    value.headline.confidence <= 1 &&
    ['career', 'wealth', 'love', 'health', 'social'].every((key) => {
      const score = value.headline?.scores[key as keyof Report['headline']['scores']];
      return typeof score === 'number' && Number.isInteger(score) && score >= 1 && score <= 5;
    }) &&
    Array.isArray(value.sections) &&
    value.sections.every(
      (section) =>
        typeof section.key === 'string' &&
        typeof section.title === 'string' &&
        typeof section.lead === 'string' &&
        Array.isArray(section.blocks) &&
        section.blocks.every((block) => {
          switch (block.type) {
            case 'paragraph':
              return typeof block.text === 'string' && typeof block.unitId === 'string';
            case 'transition':
              return typeof block.text === 'string';
            case 'evidence':
              return (
                Array.isArray(block.items) &&
                block.items.every((item) =>
                  ['label', 'path', 'value', 'anchor'].every(
                    (key) => typeof item[key as keyof typeof item] === 'string',
                  ),
                )
              );
            case 'advice':
              return (
                Array.isArray(block.items) && block.items.every((item) => typeof item === 'string')
              );
            case 'sources':
              return (
                Array.isArray(block.items) &&
                block.items.every(
                  (item) => typeof item.text === 'string' && typeof item.from === 'string',
                )
              );
            case 'chart_ref':
              return (
                typeof block.component === 'string' &&
                !!block.props &&
                typeof block.props === 'object'
              );
            default:
              return false;
          }
        }),
    ) &&
    Array.isArray(value.hits) &&
    value.hits.every(
      (hit) =>
        typeof hit.unitId === 'string' &&
        typeof hit.weight === 'number' &&
        Array.isArray(hit.evidence),
    ) &&
    (!value.doDont ||
      (Array.isArray(value.doDont.do) &&
        Array.isArray(value.doDont.dont) &&
        [...value.doDont.do, ...value.doDont.dont].every((v) => typeof v === 'string'))),
  );
}
/** Load the saved interpretation in another locale without recalculating the chart. */
export async function loadNativeReading(
  id: string,
  system: ReportSystem,
  locale: MobileLocale,
): Promise<NativeReading | null> {
  const store = await getLocalStore();
  const record = await store.readings.get(id);
  if (!record?.data || record.data.system !== system) return null;
  const data = record.data;
  const chart = parseNativeChart(system, data.chart);
  let raw = locale === 'en' ? data.reportEn : data.reportZh;
  if (raw === null) {
    const knowledge = await getOfflineKnowledge(system);
    const report = interpret({
      system,
      chart: chart.data,
      locale: locale === 'en' ? 'en' : 'zh',
      knowledge,
      context: {
        now: record.createdAt,
        profileHasTime: !data.inputSnapshot.birth?.timeUnknown,
        engineVersion: data.engineVersion,
      },
    });
    // DESIGN-GAP: Legacy one-language device records get a persisted second interpretation;
    // the existing language and original chart remain the saved snapshot.
    await store.readings.save(
      { ...data, [locale === 'en' ? 'reportEn' : 'reportZh']: { ...report } },
      id,
    );
    raw = { ...report };
  }
  if (!isReport(raw) || raw.system !== system || raw.locale !== (locale === 'en' ? 'en' : 'zh'))
    throw new Error('E_INVALID_INPUT');
  const profiles = await store.profiles.list(500);
  const owner = profiles.find((p) => p.id === data.profileId);
  const partner = profiles.find((p) => p.id === data.inputSnapshot.partnerProfileId);
  const warnings =
    data.meta?.warnings ??
    (data.inputSnapshot.birth ? normalizeBirth(data.inputSnapshot.birth).warnings : []);
  if (
    !data.meta &&
    data.inputSnapshot.birth?.timeUnknown &&
    ['astrology', 'vedic', 'synastry'].includes(system)
  )
    warnings.push({ code: 'W_NOON_CHART', messageKey: 'engine.warnings.W_NOON_CHART' });
  return {
    record,
    chart,
    report: localizeReport(raw, locale),
    warnings,
    stale: Boolean(
      (owner?.data && owner.data.version !== data.profileVersion) ||
      (partner?.data && partner.data.version !== data.inputSnapshot.partnerProfileVersion),
    ),
  };
}
/** Map errors to documented localized engine codes without exposing personal error details. */
export function readingError(error: unknown) {
  if (
    error &&
    typeof error === 'object' &&
    'code' in error &&
    Object.values(EngineErrorCode).some((code) => code === error.code)
  )
    return `engine.errors.${String(error.code)}`;
  return 'mobile.storage.error';
}
