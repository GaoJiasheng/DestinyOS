import {
  dimensions,
  evaluateWhen,
  specificity,
  resolvePath,
  deduplicate,
  equal,
  enWords,
  zhChars,
} from '@tianji/content';
import type { KnowledgeUnit, TransitionKind, Source, Dim } from '@tianji/content';
import type { Hit, InterpretInput, Report, ReportBlock, Score, Section } from './types';
import { numeric, systemConfigs } from './config';
import { termMarker, termCount } from './terms';
import { checkReadability } from './readability';
export const interpretVersion = '1.1.0';
type Candidate = { unit: KnowledgeUnit; hit: Hit };
const order = (a: Candidate, b: Candidate) =>
  b.hit.weight - a.hit.weight || (a.unit.id < b.unit.id ? -1 : a.unit.id > b.unit.id ? 1 : 0);
export function hash(text: string): number {
  let result = 2166136261;
  for (const char of text) result = Math.imul(result ^ char.charCodeAt(0), 16777619) >>> 0;
  return result;
}
function opposite(a: KnowledgeUnit, b: KnowledgeUnit): boolean {
  return (
    a.topic === b.topic &&
    ((a.polarity === 'positive' && b.polarity === 'negative') ||
      (a.polarity === 'negative' && b.polarity === 'positive'))
  );
}
export function interpret(input: InterpretInput): Report {
  const { system, chart, locale, knowledge, context } = input;
  const config = { ...systemConfigs[system], ...input.config };
  const plan = input.sectionPlan ?? config.sectionPlan;
  const keys = new Set(plan.map((s) => s.key));
  if (
    keys.size !== plan.length ||
    plan.some(
      (s) =>
        !Number.isInteger(s.maxUnits) ||
        s.maxUnits < 1 ||
        s.maxUnits > (s.key === 'overview' ? 3 : 6),
    )
  )
    throw new Error('Invalid sectionPlan');
  const disclaimer = knowledge.units.find(
    (u) => u.id === 'common.disclaimer' && u.meta.status === 'published',
  );
  if (!disclaimer) throw new Error('Published common.disclaimer is required');
  const evaluated: Candidate[] = [];
  for (const unit of knowledge.units) {
    if (unit.meta.status !== 'published' || unit.system !== system || !keys.has(unit.section))
      continue;
    const result = evaluateWhen(chart, unit.when);
    if (!result.matched) continue;
    const multiplier = config.weightMultiplier?.(unit, chart) ?? 1;
    if (!Number.isFinite(multiplier) || multiplier < 0)
      throw new Error(`Invalid multiplier for ${unit.id}`);
    evaluated.push({
      unit,
      hit: {
        unitId: unit.id,
        weight: unit.weight * multiplier + specificity(unit.when),
        section: unit.section,
        evidence: result.evidence,
      },
    });
  }
  evaluated.sort(order);
  // §8 variants have the same conditions and reciprocal exclusions; select one before conflict resolution.
  const variantChoices = new Map<string, string>();
  for (const candidate of evaluated) {
    if (!/\.[abc]$/.test(candidate.unit.id)) continue;
    const root = candidate.unit.id.slice(0, -2);
    if (variantChoices.has(root)) continue;
    const variants = evaluated
      .filter(
        (other) =>
          other.unit.id.slice(0, -2) === root &&
          /\.[abc]$/.test(other.unit.id) &&
          other.unit.topic === candidate.unit.topic &&
          other.unit.section === candidate.unit.section &&
          equal(other.unit.when, candidate.unit.when) &&
          (other.unit.id === candidate.unit.id ||
            (candidate.unit.exclusive_with.includes(other.unit.id) &&
              other.unit.exclusive_with.includes(candidate.unit.id))),
      )
      .sort((a, b) => a.unit.id.localeCompare(b.unit.id, 'en'));
    if (variants.length < 2) continue;
    // DESIGN-GAP: InterpretContext did not expose §8's userId; accept it optionally.
    // Anonymous callers use the schema-ordered chart as a stable fallback without adding identity storage.
    const identity = context.userId ?? JSON.stringify(chart);
    variantChoices.set(root, variants[hash(`${identity}:${root}`) % variants.length]!.unit.id);
  }
  // Prefer an equivalent plain variant when the original exceeds the term-density budget.
  const candidates = evaluated.filter((candidate) => {
    const variant = variantChoices.get(candidate.unit.id.slice(0, -2));
    if (variant && variant !== candidate.unit.id) return false;
    const body = candidate.unit[locale].body;
    const dense =
      (termCount(body, knowledge.glossary, locale) * 100) /
        ((locale === 'zh' ? zhChars(body) : enWords(body)) || 1) >
      6;
    return (
      !dense ||
      candidate.unit.tags.includes('plain') ||
      !evaluated.some(
        (other) =>
          other.unit.tags.includes('plain') &&
          other.unit.section === candidate.unit.section &&
          other.unit.topic === candidate.unit.topic &&
          other.unit.polarity === candidate.unit.polarity &&
          equal(other.unit.when, candidate.unit.when),
      )
    );
  });
  const selected: Candidate[] = [];
  for (const candidate of candidates) {
    if (
      selected.some(
        (other) =>
          candidate.unit.topic === other.unit.topic &&
          (candidate.unit.exclusive_with.includes(other.unit.id) ||
            other.unit.exclusive_with.includes(candidate.unit.id)),
      )
    )
      continue;
    // Resolve global exclusions before section caps so a discarded high-rank unit cannot reappear.
    selected.push(candidate);
  }
  const retained = selected.filter(
    (candidate) =>
      selected.filter((c) => c.unit.section === candidate.unit.section).indexOf(candidate) <
      (plan.find((s) => s.key === candidate.unit.section)?.maxUnits ?? 0),
  );
  const truncated = new Set(
    retained
      .filter((candidate, index) =>
        retained.slice(0, index).some((other) => opposite(other.unit, candidate.unit)),
      )
      .map((c) => c.unit.id),
  );
  let confidence = config.confidence?.(chart) ?? numeric(chart, 'confidence', 1);
  if (!Number.isFinite(confidence)) throw new Error('Invalid confidence');
  confidence = Math.max(0, Math.min(1, confidence));
  // DESIGN-GAP: Missing birth time caps confidence at 0.65 until each system provides its own uncertainty model.
  if (!context.profileHasTime) confidence = Math.min(confidence, 0.65);
  const substitute = (text: string, unit: KnowledgeUnit): string => {
    const resolved = new Set<string>();
    const lookup = (key: string): string | undefined => {
      if (key.startsWith('glossary.')) {
        const parts = key.slice(9).split('.');
        const field = parts.pop();
        const entry = knowledge.glossary.find((g) => g.key === parts.join('.'));
        if (entry && field && Object.hasOwn(entry[locale], field)) {
          const value: unknown = entry[locale][field as keyof typeof entry.zh];
          if (typeof value === 'string') return value;
        }
      }
      const values = resolvePath(chart, key.replace(/^chart\./, ''));
      return values.length
        ? values.map((v) => display(v)).join(locale === 'zh' ? '、' : ', ')
        : undefined;
    };
    const replace = (value: string): string =>
      value.replace(/\{\{([\w.[\]=*'"-]+)\}\}/g, (original: string, key: string) => {
        if (resolved.has(key)) return original;
        const variable = unit.variables?.[key];
        if (variable !== undefined) {
          resolved.add(key);
          const result = replace(variable);
          resolved.delete(key);
          return result;
        }
        return lookup(key) ?? original;
      });
    return replace(text);
  };
  const display = (value: unknown): string => {
    if (typeof value === 'string') {
      const g = knowledge.glossary.find(
        (entry) => entry.key === value || entry.key.endsWith(`.${value}`),
      );
      return g?.[locale].term ?? value;
    }
    if (Array.isArray(value)) return value.map(display).join(locale === 'zh' ? '、' : ', ');
    return typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value);
  };
  const chooseTransition = (
    kind: TransitionKind,
    id: string,
    used: Set<string>,
  ): string | undefined => {
    const templates = knowledge.transitions[locale][kind];
    if (!templates.length) throw new Error(`Empty transition templates: ${kind}`);
    const start = hash(id) % templates.length;
    for (let i = 0; i < templates.length; i++) {
      const text = templates[(start + i) % templates.length];
      if (text && !used.has(text)) {
        used.add(text);
        return text;
      }
    }
    // DESIGN-GAP: Exhausted templates produce a paragraph break instead of repeating a transition.
    return undefined;
  };
  const mark = termMarker(knowledge.glossary, locale);
  const sections: Section[] = [];
  const allAdvice = deduplicate(
    retained.flatMap((c) => c.unit[locale].advice.map((text) => substitute(text, c.unit))),
    5,
  );
  for (const spec of plan) {
    const chapter = retained.filter((c) => c.unit.section === spec.key);
    const first = chapter[0];
    let lead = first ? substitute(first.unit[locale].summary, first.unit) : '';
    if (lead && confidence < 0.7)
      lead = `${chooseTransition('low_confidence', first?.unit.id ?? spec.key, new Set()) ?? ''}${locale === 'en' ? ' ' : ''}${lead}`;
    const blocks: ReportBlock[] = [],
      used = new Set<string>();
    chapter.forEach((candidate, index) => {
      const { unit } = candidate;
      const previous = chapter[index - 1];
      if (previous || truncated.has(unit.id)) {
        const changed = previous && unit.polarity !== previous.unit.polarity;
        const transition = chooseTransition(
          changed || truncated.has(unit.id) ? 'concession' : 'continuation',
          unit.id,
          used,
        );
        if (transition) blocks.push({ type: 'transition', text: transition });
      }
      blocks.push({
        type: 'paragraph',
        unitId: unit.id,
        polarity: unit.polarity,
        text: substitute(truncated.has(unit.id) ? unit[locale].summary : unit[locale].body, unit),
      });
    });
    const evidence = chapter
      .flatMap((c) => c.hit.evidence)
      .filter(
        (item, n, items) =>
          items.findIndex((other) => other.path === item.path && equal(other.value, item.value)) ===
          n,
      );
    if (evidence.length)
      blocks.push({
        type: 'evidence',
        items: evidence.map((item) => {
          const value = display(item.value);
          const leaf = item.path.split('.').at(-1) ?? item.path;
          const entry = knowledge.glossary.find((g) => g.key === item.path || g.key === leaf);
          // DESIGN-GAP: Anchors use URI-encoded paths; chart renderers can link to these exact stable IDs.
          return {
            label: entry?.[locale].term ?? value,
            path: item.path,
            value,
            anchor: `chart:${encodeURIComponent(item.path)}`,
          };
        }),
      });
    const advice =
      spec.key === 'summary_actions'
        ? allAdvice
        : deduplicate(
            chapter.flatMap((c) => c.unit[locale].advice.map((text) => substitute(text, c.unit))),
            3,
          );
    if (advice.length) blocks.push({ type: 'advice', items: advice });
    const sources: Source[] = chapter
      .flatMap((c) =>
        (c.unit[locale].sources ?? []).map((source) => ({
          text: substitute(source.text, c.unit),
          from: substitute(source.from, c.unit),
        })),
      )
      .filter(
        (source, index, list) =>
          list.findIndex((s) => s.text === source.text && s.from === source.from) === index,
      );
    if (sources.length) blocks.push({ type: 'sources', items: sources });
    if (spec.chartRef) blocks.push({ type: 'chart_ref', ...spec.chartRef });
    if (spec.key === 'summary_actions') {
      if (!lead) lead = substitute(disclaimer[locale].summary, disclaimer);
      blocks.push({
        type: 'paragraph',
        unitId: disclaimer.id,
        polarity: disclaimer.polarity,
        text: substitute(disclaimer[locale].body, disclaimer),
      });
    }
    sections.push({ key: spec.key, title: spec.title[locale], lead, blocks });
  }
  // DESIGN-GAP: Divination tables omit summary_actions; append the shared summary required by 05 §4.
  if (!keys.has('summary_actions'))
    sections.push({
      key: 'summary_actions',
      title:
        systemConfigs.bazi.sectionPlan.find((s) => s.key === 'summary_actions')?.title[locale] ??
        disclaimer[locale].title,
      lead: disclaimer[locale].summary,
      blocks: [
        { type: 'advice', items: allAdvice },
        {
          type: 'paragraph',
          text: disclaimer[locale].body,
          unitId: disclaimer.id,
          polarity: disclaimer.polarity,
        },
      ],
    });
  const tags = new Map<string, number>();
  for (const c of evaluated)
    for (const tag of new Set(c.unit.tags))
      if (tag !== 'plain') tags.set(tag, (tags.get(tag) ?? 0) + c.hit.weight);
  const keywords = [...tags]
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, 3)
    .map(([tag]) => knowledge.glossary.find((g) => g.key === tag)?.[locale].term ?? tag);
  // DESIGN-GAP: Non-daily base-score formulas are unspecified; neutral 3 is configurable via baseScores.
  const base = config.baseScores?.(chart) ?? {};
  const scores = {} as Record<Dim, Score>;
  for (const dim of dimensions) {
    const total =
      (base[dim] ?? 3) + retained.reduce((sum, c) => sum + (c.unit.scores?.[dim] ?? 0), 0);
    if (!Number.isFinite(total)) throw new Error(`Invalid base score ${dim}`);
    scores[dim] = Math.max(1, Math.min(5, Math.round(total))) as Score;
  }
  const overview = retained.find((c) => c.unit.section === 'overview');
  const persona = overview ? substitute(overview.unit[locale].summary, overview.unit) : '';
  for (const section of sections) {
    section.lead = mark(section.lead);
    for (const block of section.blocks) {
      if (block.type === 'paragraph') block.text = mark(block.text);
      else if (block.type === 'advice') block.items = block.items.map(mark);
    }
  }
  const report: Report = {
    system,
    locale,
    knowledgeVersion: knowledge.knowledgeVersion,
    // DESIGN-GAP: The chart engine is still a skeleton; callers may pass the generating engine version.
    engineVersion: context.engineVersion ?? '0.0.0',
    interpretVersion,
    headline: { persona, keywords, scores, confidence },
    sections,
    hits: retained.map((c) => c.hit),
    doDont: {
      do: deduplicate(
        retained.flatMap((c) => c.unit[locale].do.map((t) => substitute(t, c.unit))),
        3,
      ),
      dont: deduplicate(
        retained.flatMap((c) => c.unit[locale].dont.map((t) => substitute(t, c.unit))),
        3,
      ),
    },
    readability: { zhChars: 0, enWords: 0, termDensity: 0, passed: false, issues: [] },
    disclaimerKey: disclaimer.id,
  };
  report.readability = checkReadability(report, knowledge.glossary);
  return report;
}
