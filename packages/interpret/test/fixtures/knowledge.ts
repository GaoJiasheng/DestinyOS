import { seeds } from './knowledge-seeds';
import type { KnowledgeBundle, KnowledgeUnit, LocalizedUnit } from '@tianji/content';
import chart from '../../../content/test/fixtures/bazi.a.json';
export const baziChart = chart;
// DESIGN-GAP: Fixture A has documented pillars but no verified interpretive measurements yet.
// Handwritten strengths, stars and periods above are illustrative, not a golden calculation result.
const commonZh =
  '在生活中，你可以把这些象征当作观察习惯的工具，而不急着为自己下结论。面对新的任务，先看当前资源与实际需要，再决定如何安排节奏。比如在团队讨论中，留出一段时间听取不同意见，记录你希望解决的具体问题，然后选一个可以完成的小步骤。建议每周回顾一次行动后的感受，看看哪些方式帮助了沟通，哪些需要调整。传统分类提供的是一个思考角度，你自己的经验、选择和现实条件仍然很重要。';
const commonEn =
  'In everyday life, you can treat this symbol as a prompt for observing your habits rather than a fixed description of who you are. When a new task arrives, review your resources and the practical needs of the situation before choosing your pace. For example, during a team discussion, make time to hear a different perspective and write down the specific problem you want to solve. Then choose a manageable next step. Consider reviewing how that action felt at the end of the week, noticing which choices helped communication and which need adjustment. The traditional category offers a perspective for reflection. Your own experience, decisions and circumstances remain central to deciding whether the idea is useful for you.';
function localized(
  title: string,
  zh: string,
  en: string,
  adviceZh: string,
  adviceEn: string,
  overview: boolean,
): { zh: LocalizedUnit; en: LocalizedUnit } {
  return {
    zh: {
      title,
      summary: zh,
      body: `${zh}${overview ? '你可以从一个小目标开始，把观察与现实经验放在一起。与人相处时留出倾听的空间，遇到压力时先整理手头的资源，记录本周做得顺畅的一件事，再挑一个可以调整的细节。这个文化视角适合帮助你回顾自己的习惯，行动之前也要考虑实际情况，建议按适合自己的速度慢慢尝试。' : commonZh}`,
      advice: [adviceZh],
      do: ['留出余地'],
      dont: ['急于定论'],
      sources: [{ text: '知之为知之，不知为不知，是知也。', from: '《论语》' }],
    },
    en: {
      title: en,
      summary: en,
      body: `${en} ${commonEn}`,
      advice: [adviceEn],
      do: ['Leave room'],
      dont: ['Rush conclusions'],
      sources: [
        {
          text: 'Recognize what you know and what you do not know.',
          from: 'Analects, public-domain paraphrase',
        },
      ],
    },
  };
}
export const units: KnowledgeUnit[] = seeds.map(
  ([key, section, topic, weight, polarity, zh, en, adviceZh, adviceEn, when]) => ({
    id: `bazi.${key}`,
    system: 'bazi',
    section,
    topic,
    weight,
    polarity,
    when,
    tags: ['career', 'social', 'wealth'],
    exclusive_with: [],
    ...localized(zh, zh, en, adviceZh, adviceEn, section === 'overview'),
    meta: { author: 'handwritten-test', reviewed_by: null, version: 1, status: 'published' },
  }),
);
const precise = units.find((u) => u.id === 'bazi.nature.precise');
const competitor = units.find((u) => u.id === 'bazi.nature.competitor');
if (precise && competitor) {
  precise.exclusive_with = [competitor.id];
  competitor.exclusive_with = [precise.id];
  precise.scores = { career: 3, social: -3 };
  competitor.scores = { wealth: 3 };
}
/** Build the handwritten Bazi interpretation fixture with the published common glossary and disclaimer. */
export function bundle(common: KnowledgeBundle): KnowledgeBundle {
  // Keep the algorithm's thirty illustrative cases isolated from production KU
  // rankings; the real corpus has separate engine + interpret integration tests.
  return {
    ...common,
    units: [...units, ...common.units.filter((u) => u.system === 'common')],
    // Match production bundles: unrelated system terminology must not inflate Bazi density.
    glossary: common.glossary.filter(
      (entry) => entry.system === 'bazi' || entry.system === 'common',
    ),
  };
}
