import { AshtakootChartSchema, type AshtakootChart } from '@tianji/shared';
import { EngineError } from '../common/error';
import { mod } from '../common/ganzhi';
// DESIGN-GAP: Versioned North Indian base tables follow AIFAS Horoscope Matching (2021), pp.111–115. No dosha cancellations silently add points.
export const ASHTAKOOT_SCHOOL = 'aifas_2021_base_v1';
// Rows = B (traditional bride), columns = A (traditional groom). Roles are positional, independent of gender.
export const VASHYA_TABLE = [
  [2, 1, 1, 0, 1],
  [1, 2, 1, 0, 1],
  [1, 1, 2, 1, 1],
  [0, 0, 1, 2, 0],
  [1, 1, 1, 0, 2],
] as const;
export const GANA_TABLE = [
  [6, 5, 1],
  [6, 6, 0],
  [1, 0, 6],
] as const;
export const YONI_TABLE = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 1, 1, 4, 1, 1, 2, 1],
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
] as const;
export const MAITRI_TABLE = [
  [5, 5, 5, 4, 5, 0, 0],
  [5, 5, 4, 1, 4, 0.5, 0.5],
  [5, 4, 5, 0.5, 5, 3, 0.5],
  [4, 1, 0.5, 5, 0.5, 5, 4],
  [5, 4, 5, 0.5, 5, 0.5, 3],
  [0, 0.5, 3, 5, 0.5, 5, 5],
  [0, 0.5, 0.5, 4, 3, 5, 5],
] as const;
const varnas = [
  'kshatriya',
  'vaishya',
  'shudra',
  'brahmin',
  'kshatriya',
  'vaishya',
  'shudra',
  'brahmin',
  'kshatriya',
  'vaishya',
  'shudra',
  'brahmin',
] as const;
const ranks = { shudra: 0, vaishya: 1, kshatriya: 2, brahmin: 3 };
const vashyas = ['quadruped', 'human', 'aquatic', 'wild', 'insect'] as const;
const yonis = [
  'horse',
  'elephant',
  'sheep',
  'serpent',
  'dog',
  'cat',
  'rat',
  'cow',
  'buffalo',
  'tiger',
  'deer',
  'monkey',
  'mongoose',
  'lion',
] as const;
const yoniIndex = [
  0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1,
] as const;
const ganas = ['deva', 'manushya', 'rakshasa'] as const;
const ganaIndex = [
  0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0,
] as const;
const nadis = ['adi', 'madhya', 'antya'] as const;
const nadiIndex = [
  0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2,
] as const;
const lords = ['surya', 'chandra', 'mangala', 'budha', 'guru', 'shukra', 'shani'] as const;
const lordIndex = [2, 5, 3, 1, 0, 3, 5, 2, 4, 6, 6, 4] as const;
function traits(lon: number) {
  const sign = Math.floor(lon / 30),
    nak = Math.floor(lon / (360 / 27)),
    degree = lon % 30;
  const vashya =
    sign === 8
      ? degree < 15
        ? 1
        : 0
      : sign === 9
        ? degree < 15
          ? 0
          : 2
        : [0, 0, 1, 2, 3, 1, 1, 4, 1, 0, 1, 2][sign]!;
  return {
    sign,
    nak,
    varna: varnas[sign]!,
    vashya,
    yoni: yoniIndex[nak]!,
    gana: ganaIndex[nak]!,
    nadi: nadiIndex[nak]!,
    lord: lordIndex[sign]!,
  };
}
/** Full 36-Guna base score from two Lahiri sidereal Moon longitudes in [0,360) degrees; A/B are explicit traditional roles. */
export function computeAshtakoot(aLon: number, bLon: number, provisional = false): AshtakootChart {
  if (![aLon, bLon].every((n) => Number.isFinite(n) && n >= 0 && n < 360))
    throw new EngineError('E_INVALID_INPUT');
  const a = traits(aLon),
    b = traits(bLon),
    forward = mod(b.nak - a.nak, 27) + 1,
    backward = mod(a.nak - b.nak, 27) + 1;
  const tara = (count: number) => ([3, 5, 7].includes(count % 9) ? 0 : 1.5);
  const distances: [number, number] = [mod(b.sign - a.sign, 12) + 1, mod(a.sign - b.sign, 12) + 1];
  const kootas: AshtakootChart['kootas'] = [
    {
      key: 'varna',
      max: 1,
      score: ranks[a.varna] >= ranks[b.varna] ? 1 : 0,
      a: a.varna,
      b: b.varna,
    },
    {
      key: 'vashya',
      max: 2,
      score: VASHYA_TABLE[b.vashya]![a.vashya]!,
      a: vashyas[a.vashya]!,
      b: vashyas[b.vashya]!,
    },
    {
      key: 'tara',
      max: 3,
      score: tara(forward) + tara(backward),
      a: String(forward),
      b: String(backward),
    },
    {
      key: 'yoni',
      max: 4,
      score: YONI_TABLE[b.yoni]![a.yoni]!,
      a: yonis[a.yoni]!,
      b: yonis[b.yoni]!,
    },
    {
      key: 'graha_maitri',
      max: 5,
      score: MAITRI_TABLE[b.lord]![a.lord]!,
      a: lords[a.lord]!,
      b: lords[b.lord]!,
    },
    {
      key: 'gana',
      max: 6,
      score: GANA_TABLE[b.gana]![a.gana]!,
      a: ganas[a.gana]!,
      b: ganas[b.gana]!,
    },
    {
      key: 'bhakoot',
      max: 7,
      score: distances.some((d) => [2, 5, 6, 8, 9, 12].includes(d)) ? 0 : 7,
      a: String(distances[0]),
      b: String(distances[1]),
    },
    { key: 'nadi', max: 8, score: a.nadi === b.nadi ? 0 : 8, a: nadis[a.nadi]!, b: nadis[b.nadi]! },
  ];
  return AshtakootChartSchema.parse({
    total: kootas.reduce((s, k) => s + k.score, 0),
    max: 36,
    kootas,
    provisional,
    moonLongitudes: [aLon, bLon],
    taraCounts: [forward, backward],
    signDistances: distances,
  });
}
