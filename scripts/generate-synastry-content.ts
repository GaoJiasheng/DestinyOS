import { synastryExercises } from './synastry-exercises';
import { mkdir, writeFile } from 'node:fs/promises';
import { stringify } from 'yaml';
import type { KnowledgeUnit, When } from '../packages/content/src';
const units: KnowledgeUnit[] = [];
// DESIGN-GAP: Offline editorial production is deterministic and checked into YAML; runtime uses only published KU data.
const contexts = {
  overview: [
    '整体契合',
    'overall connection',
    '两个人如何理解彼此的不同',
    'how two people understand their differences',
    '安排一次轻松的共同活动，观察彼此喜欢怎样分配任务',
    'plan a relaxed shared activity and notice how each person prefers to divide tasks',
  ],
  communication: [
    '沟通',
    'communication',
    '表达方式、倾听节奏与确认信息',
    'expression, listening pace, and checking information',
    '讨论一件小事时先复述对方的观点，再提出自己的请求',
    'repeat the other person’s view before making your own request during a small discussion',
  ],
  love: [
    '感情',
    'affection',
    '亲近、关怀与个人边界',
    'closeness, care, and personal boundaries',
    '分别写下三种喜欢的关心方式，问清楚哪些举动需要提前确认',
    'each write down three welcome forms of care and ask which gestures need agreement in advance',
  ],
  values_money: [
    '价值观与金钱',
    'values and money',
    '时间、资源及共同决定的优先级',
    'priorities for time, resources, and shared decisions',
    '选择一笔日常支出，说明用途和可接受范围，再共同制定复盘时间',
    'choose an everyday expense, explain its purpose and acceptable range, and agree on a review date',
  ],
  conflict: [
    '冲突模式',
    'conflict patterns',
    '分歧出现时的反应与修复方式',
    'responses to disagreement and ways of repairing a conversation',
    '约定暂停讨论的信号以及重新沟通的时间，避免让沉默变成猜测',
    'agree on a pause signal and a time to return so that silence does not become guesswork',
  ],
  long_term: [
    '长期建议',
    'long-term advice',
    '持续合作与定期调整期待',
    'ongoing cooperation and regular changes to expectations',
    '每周选一个共同事项复盘，保留有效做法并调整一个不适合的环节',
    'review one shared responsibility each week, keep what works, and change one step that is uncomfortable',
  ],
} as const;
type Section = keyof typeof contexts;
function add(
  id: string,
  section: Section,
  when: When,
  zhFact: string,
  enFact: string,
  zhMeaning: string,
  enMeaning: string,
  weight = 70,
) {
  const [zhTitle, enTitle, , , zhAction, enAction] = contexts[section];
  const tails = [
    [
      '你可以拿最近一次共同安排来核对，先写下原本期待的结果，再比较双方当时掌握的信息。计划改变以后，一方可能希望尽快找到替代方案，另一方更想知道为什么发生变化。给解释与行动分别留出一点时间，会让两种需要更容易被满足。讨论结束时，把接下来由谁完成哪一步、什么时候确认进度说清楚。过几天再看看这个安排是否合适。相处方式可以学习与调整，不必让一次不顺畅的经历成为对人的固定评价。',
      'Consider a recent shared plan. Write down the outcome each person expected and the information available at the time. After a change, one person may want a replacement plan quickly while the other wants an explanation first. Leave room for both a reason and an action. At the end, clarify who will complete the next step and when progress will be checked. Review the arrangement a few days later. Ways of relating can be learned and revised; a single awkward experience need not become a permanent judgment about someone.',
    ],
    [
      '例如，两个人都想获得支持，却可能分别通过安静陪伴和主动询问来表达。先问对方此刻需要倾听、建议还是实际帮助，可以减少好意没有被理解的情况。也给自己留下拒绝某种安排的空间，说明能够做到什么以及暂时做不到什么。共同活动以后，各自分享一个舒服的瞬间和一个还想调整的部分。让感谢指向具体举动，会比泛泛评价更容易让人理解。双方的意愿和感受是讨论的依据，符号只是辅助观察的语言。',
      'Two people may both want support but express it through quiet company or active questions. Ask whether the other person currently wants listening, a suggestion, or practical help. This can prevent a kind gesture from being misunderstood. Leave yourself room to decline an arrangement, explaining what you can do and what is currently beyond your capacity. After an activity, each share one comfortable moment and one part to adjust. Appreciation attached to a specific gesture is easier to understand than a broad judgment. Consent and lived feelings remain the basis of the conversation.',
    ],
    [
      '一个可核对的场景是一起处理日常任务：谁先提出想法，谁整理细节，谁提醒时间。把这些动作与个人价值分开看，暂时做得少也许只是空闲时间不同。可以先试行一个较小的分工，再约定如何提出修改。发生分歧时，记录两个人已经同意的条件，以及仍然需要查清的信息，不要让对话围着同一句评价打转。任务完成以后，回顾哪一步节省了精力、哪一步增加了压力，从中选择一个值得继续的做法。',
      'Look at an everyday task: who suggests an idea, who organizes details, and who notices the time? Separate these actions from a judgment of personal worth. Doing less for a while may simply reflect different available time. Try a small division of responsibility and agree on how changes can be requested. When a difference appears, record the conditions already agreed and the information still needed. This keeps the conversation from circling one criticism. After finishing, identify a step that saved energy and a step that increased pressure, then choose what to keep.',
    ],
    [
      '观察时也可以从各自的生活背景开始：一个家庭习惯把想法直接说出来，另一个家庭可能先照顾气氛。没有哪种表达天然适合所有场景。把这些习惯讲给对方听，有助于理解一句话背后的意思。遇到不熟悉的方式，先提出澄清问题，再决定怎样回应。双方分别保留自己的兴趣、朋友与休息时间，也能让共同安排更有弹性。隔一段时间重新确认期待是否改变，允许曾经合适的办法被新的安排替代。',
      'Begin with each person’s background. One household may encourage direct expression while another puts the atmosphere first. Neither habit suits every situation. Explain these learned patterns to one another to make the intention behind a sentence easier to understand. When a response is unfamiliar, ask for clarification before deciding how to react. Keep space for independent interests, friendships, and rest alongside joint activities. Revisit expectations after some time and allow an arrangement that once worked to be replaced when circumstances change. Cultural context matters more than assigning a fixed character label.',
    ],
    [
      '你可以把一段对话分成事实、感受与请求三个部分。事实是双方能描述的具体事情，感受属于个人体验，请求则是可以答应、拒绝或重新协商的动作。把三者混在一起容易让人听成指责；分开以后，讨论会更清楚。选择一个轻松的小问题先练习，给每个人完整说完的时间。需要暂停时约定什么时候回来，不把等待变成无限期的沉默。修复关系往往从一次愿意重新倾听开始，也需要持续尊重各自的边界。',
      'Divide a conversation into an observation, a feeling, and a request. An observation describes an event both people can recognize. A feeling belongs to the person experiencing it. A request names an action that can be accepted, declined, or renegotiated. Mixing all three can sound like blame; separating them makes the discussion clearer. Practice with a small question and give each person time to finish. If a pause is needed, agree on a return time instead of leaving an indefinite silence. Repair often begins with a willingness to listen again while respecting boundaries.',
    ],
    [
      '另一种练习是分别回顾一件配合顺畅的事情，找出当时有哪些条件：是否有充足时间、是否事先知道目标、是否能自由提出不同意见。把这些条件搬到下一次共同安排里，再观察效果。若某个办法只让一方舒服，就一起调整执行方式，而不是要求另一方接受同样的感觉。每次只修改一个环节，能更容易看见变化来自哪里。长期相处会经历新的工作节奏与家庭责任，定期讨论现状比照搬早先的约定更有帮助。',
      'Recall an activity that went smoothly. Identify the conditions present: enough time, a shared goal, and freedom to offer a different opinion. Bring those conditions into the next plan and observe the result. If an arrangement feels comfortable for only one person, change how it is carried out instead of requiring the other to share the same feeling. Modify one step at a time so the effect is easier to notice. Long relationships encounter changing work schedules and family responsibilities. Regular discussion of current circumstances is more useful than mechanically repeating an early agreement.',
    ],
  ] as const;
  const tail = tails[units.length % tails.length]!;
  const zhBody =
    section === 'overview'
      ? `${zhFact}。${zhMeaning}。合盘提供一种讨论差异的语言，结果需要与真实经历一起看。建议${zhAction}。双方可以先选一个共同尝试的小动作。相处经验、个人边界和当下意愿比单项分数更重要。记录一次尝试后的感受，并允许随着生活变化重新调整安排。`
      : `${zhFact}。${zhMeaning}。建议${zhAction}。${tail[0]}`;
  const enBody = `${enFact}. ${enMeaning}. Try to ${enAction}. ${tail[1]} A chart offers a starting point for reflection, while each person remains free to choose how to participate.`;
  units.push({
    id: `synastry.${id}`,
    system: 'synastry',
    section,
    topic: id,
    when,
    weight,
    polarity: 'neutral',
    tags: ['plain'],
    exclusive_with: [],
    zh: {
      title: `${zhTitle}：${zhFact}`,
      summary: zhFact,
      body: zhBody,
      advice: [zhAction],
      do: ['共同核对'],
      dont: ['贴标签'],
    },
    en: {
      title: `${enTitle}: ${enFact}`,
      summary: enFact,
      body: enBody,
      advice: [enAction],
      do: ['Check together'],
      dont: ['Label people'],
    },
    meta: { author: 'synastry-editorial-v1', reviewed_by: null, version: 1, status: 'published' },
  });
}
const planets = [
  ['sun', '太阳', 'identity and direction'],
  ['moon', '月亮', 'emotional safety and habitual responses'],
  ['mercury', '水星', 'language and information'],
  ['venus', '金星', 'affection and preferences'],
  ['mars', '火星', 'initiative and assertion'],
  ['jupiter', '木星', 'growth and shared meaning'],
  ['saturn', '土星', 'responsibility and limits'],
] as const;
const pairs = [
  ['sun', 'moon'],
  ['moon', 'sun'],
  ['sun', 'sun'],
  ['moon', 'moon'],
  ['venus', 'mars'],
  ['mars', 'venus'],
  ['venus', 'venus'],
  ['mercury', 'mercury'],
  ['mercury', 'moon'],
  ['moon', 'mercury'],
  ['mercury', 'sun'],
  ['sun', 'mercury'],
  ['mercury', 'mars'],
  ['mars', 'mercury'],
  ['mercury', 'saturn'],
  ['saturn', 'mercury'],
  ['venus', 'moon'],
  ['moon', 'venus'],
  ['sun', 'saturn'],
  ['saturn', 'sun'],
  ['venus', 'saturn'],
  ['saturn', 'venus'],
  ['jupiter', 'venus'],
  ['venus', 'jupiter'],
  ['mars', 'saturn'],
] as const;
const aspects = [
  [
    'conjunction',
    '合相',
    'conjunction',
    '两种功能集中在相近的方向，容易放大彼此的主题',
    'The two functions occupy a similar direction and may amplify each other’s themes',
  ],
  [
    'sextile',
    '六分相',
    'sextile',
    '两种功能之间有尝试合作的空间，仍需要主动沟通',
    'The two functions have room for cooperation that still requires deliberate participation',
  ],
  [
    'square',
    '四分相',
    'square',
    '节奏上的张力可能让差异更明显，具体分工能减少反复争论',
    'Differences in timing may become visible; specific responsibilities can reduce recurring arguments',
  ],
  [
    'trine',
    '三分相',
    'trine',
    '相近的表达习惯可能减少协调成本，也需要留意未经讨论的假设',
    'Similar habits may reduce coordination effort, while leaving some assumptions unspoken',
  ],
  [
    'opposition',
    '对分相',
    'opposition',
    '两种功能强调相对的立场，倾听双方期待有助于找到共同点',
    'The two functions emphasize opposing perspectives; hearing both expectations can uncover common ground',
  ],
] as const;
for (const [a, b] of pairs)
  for (const [type, zh, en, zm, em] of aspects) {
    const pa = planets.find((p) => p[0] === a)!,
      pb = planets.find((p) => p[0] === b)!;
    const section: Section =
      a === 'mercury' || b === 'mercury'
        ? 'communication'
        : a === 'saturn' || b === 'saturn'
          ? 'long_term'
          : a === 'jupiter' || b === 'jupiter'
            ? 'values_money'
            : 'love';
    add(
      `western.${a}_${b}.${type}`,
      section,
      { path: `western.aspects[a=${a}][b=${b}].type`, eq: type },
      `A 的${pa[1]}与 B 的${pb[1]}呈${zh}`,
      `A’s ${a} and B’s ${b} form a ${en}`,
      `${zm}；需要结合${pa[1]}与${pb[1]}各自的象征功能来理解`,
      `${em}, especially where ${pa[2]} meets ${pb[2]}`,
    );
  }
const gods = [
  ['bi_jian', '比肩', 'peer', '自主与平等', 'autonomy and equality'],
  ['jie_cai', '劫财', 'competitor', '协作与资源边界', 'cooperation and resource boundaries'],
  ['shi_shen', '食神', 'creative expression', '照顾与表达', 'care and expression'],
  ['shang_guan', '伤官', 'critical expression', '直接表达与规则', 'direct expression and rules'],
  [
    'pian_cai',
    '偏财',
    'flexible resources',
    '灵活调配与机会',
    'flexible allocation and opportunities',
  ],
  [
    'zheng_cai',
    '正财',
    'steady resources',
    '日常预算与责任',
    'everyday budgets and responsibility',
  ],
  ['qi_sha', '七杀', 'challenge', '压力下的行动', 'action under pressure'],
  ['zheng_guan', '正官', 'order', '规则与承诺', 'rules and commitments'],
  ['pian_yin', '偏印', 'unconventional support', '独立学习与关心', 'independent learning and care'],
  ['zheng_yin', '正印', 'nurturing support', '安全与学习', 'security and learning'],
] as const;
for (const side of ['a', 'b'] as const)
  for (const [god, z, e, zm, em] of gods)
    add(
      `bazi.${side}.${god}`,
      'values_money',
      { path: `bazi.tenGodInteractions[observer=${side}].stemGod`, eq: god },
      `${side.toUpperCase()} 看对方天干有${z}关系`,
      `${side.toUpperCase()} sees a ${e} relationship to the other chart`,
      `这是一种以日主为参照的五行与阴阳关系，提示可以一起讨论${zm}`,
      `This is an element and polarity relationship measured from the day stem, inviting a discussion about ${em}`,
    );
const stars = [
  ['zi_wei', '紫微', 'leadership'],
  ['tian_ji', '天机', 'planning'],
  ['tai_yang', '太阳', 'visibility'],
  ['wu_qu', '武曲', 'practical responsibility'],
  ['tian_tong', '天同', 'ease'],
  ['lian_zhen', '廉贞', 'boundaries'],
  ['tian_fu', '天府', 'stability'],
  ['tai_yin', '太阴', 'quiet care'],
  ['tan_lang', '贪狼', 'curiosity'],
  ['ju_men', '巨门', 'discussion'],
  ['tian_xiang', '天相', 'fairness'],
  ['tian_liang', '天梁', 'guidance'],
  ['qi_sha', '七杀', 'decisive action'],
  ['po_jun', '破军', 'change'],
] as const;
for (const side of ['a', 'b'] as const)
  for (const [star, z, e] of stars)
    add(
      `ziwei.${side}.${star}`,
      'long_term',
      { path: `${side}.ziwei.palaces[key=spouse].majorStars[*].key`, eq: star },
      `${side.toUpperCase()} 的夫妻宫见${z}`,
      `${side.toUpperCase()} has ${star.replaceAll('_', ' ')} in the spouse palace`,
      `主星可以作为理解长期相处期待的象征，需要同时查看对方命宫以及双方三方四正中的四化`,
      `The palace star provides a symbol for ${e} in partnership; read it alongside the other life palace and transformations in both palace triangles`,
    );
for (const [i, key] of [
  'varna',
  'vashya',
  'tara',
  'yoni',
  'graha_maitri',
  'gana',
  'bhakoot',
  'nadi',
].entries())
  for (const band of ['zero', 'partial', 'full'] as const) {
    const max = i + 1;
    const when: When =
      band === 'zero'
        ? { path: `ashtakoot.kootas[key=${key}].score`, eq: 0 }
        : band === 'full'
          ? { path: `ashtakoot.kootas[key=${key}].score`, eq: max }
          : {
              all: [
                { path: `ashtakoot.kootas[key=${key}].score`, gte: 0.5 },
                { path: `ashtakoot.kootas[key=${key}].score`, lte: max - 0.5 },
              ],
            };
    add(
      `ashtakoot.${key}.${band}`,
      key === 'graha_maitri' ? 'communication' : key === 'yoni' ? 'love' : 'overview',
      when,
      `${key} 分项${band === 'full' ? '满分' : band === 'zero' ? '为零' : '部分得分'}`,
      `${key.replaceAll('_', ' ')} has a ${band} score`,
      `这一项属于传统八项计分表，最高 ${max} 分；请把它和其余七项一起看，不能据此判断个人价值、健康或关系结果`,
      `This traditional table component has a maximum of ${max} points; view it with the other seven without making claims about personal worth, health, or relationship outcomes`,
    );
  }
for (const element of ['wood', 'fire', 'earth', 'metal', 'water'] as const)
  for (const side of ['a', 'b'] as const)
    add(
      `elements.${side}.${element}`,
      'values_money',
      { path: `${side}.bazi.useGod.favorable`, contains: element },
      `${side.toUpperCase()} 的喜用包含${{ wood: '木', fire: '火', earth: '土', metal: '金', water: '水' }[element]}`,
      `${side.toUpperCase()} has ${element} among favorable elements`,
      `五行互补需要比较双方实际比例与喜用支持，数量差异不等同于对方能替自己解决生活中的难题`,
      `Element complementarity compares actual distributions and favorable support; a numerical difference does not mean the other person can solve practical problems on your behalf`,
    );
for (const [path, relation, z] of [
  ['dayStemRelations', 'combine', '日干相合'],
  ['dayStemRelations', 'clash', '日干相冲'],
  ['dayBranchRelations', 'combine', '日支六合'],
  ['dayBranchRelations', 'clash', '日支六冲'],
  ['dayBranchRelations', 'harm', '日支相害'],
  ['dayBranchRelations', 'punish', '日支相刑'],
  ['yearRelations', 'combine', '生肖六合'],
  ['yearRelations', 'clash', '生肖六冲'],
  ['yearRelations', 'tri_combine', '生肖半合'],
  ['yearRelations', 'break', '生肖相破'],
] as const)
  add(
    `relations.${path.toLowerCase()}.${relation}`,
    'conflict',
    { path: `bazi.${path}`, contains: relation },
    `双方有${z}关系`,
    `The ${path === 'dayStemRelations' ? 'day stems' : path === 'dayBranchRelations' ? 'day branches' : 'year signs'} show ${relation === 'tri_combine' ? 'a half combination' : relation}`,
    `干支关系描述两个符号之间的结构，不应单独决定相处好坏；日柱需要结合整盘，年柱关系只提供更宽泛的背景`,
    `Stem and branch relationships describe symbolic structures; day pillars require the whole chart, while year pillars give a broader background`,
  );
for (const [i, [section, z, e, zm, em]] of synastryExercises.entries())
  add(
    `practice.${i + 1}`,
    section,
    { path: 'ashtakoot.max', eq: 36 },
    `共同练习：${z}`,
    `Shared practice: ${e}`,
    `${zm}；这项练习不依赖某一体系的分数，而是帮助双方用生活经验校验解读`,
    `${em}; this practice uses lived experience to check the interpretation and does not depend on one tradition’s score`,
    30,
  );
if (units.length !== 250) throw new Error(`Expected 250 units, found ${units.length}`);
await mkdir('packages/content/synastry', { recursive: true });
await writeFile(
  'packages/content/synastry/relationships.yaml',
  stringify(units, { lineWidth: 100 }),
);
