import type { KnowledgeBundle } from '@tianji/content';
import { KnowledgeSchema } from './schema';
import bazi from '../../../../packages/content/dist/bazi.zh.json';
import ziwei from '../../../../packages/content/dist/ziwei.zh.json';
import iching from '../../../../packages/content/dist/iching.zh.json';
import qimen from '../../../../packages/content/dist/qimen.zh.json';
import tarot from '../../../../packages/content/dist/tarot.zh.json';
import astrology from '../../../../packages/content/dist/astrology.zh.json';
import vedic from '../../../../packages/content/dist/vedic.zh.json';
import numerology from '../../../../packages/content/dist/numerology.zh.json';
import synastry from '../../../../packages/content/dist/synastry.zh.json';
import daily from '../../../../packages/content/dist/daily.zh.json';

let bundled: KnowledgeBundle | undefined;
/** All ten persisted systems share compiled bilingual package content; no duplicate editorial source. */
export function bundledKnowledge(): KnowledgeBundle {
  if (!bundled) {
    const sources: { units: { id: string }[]; glossary: { key: string }[] }[] = [
      bazi,
      ziwei,
      iching,
      qimen,
      tarot,
      astrology,
      vedic,
      numerology,
      synastry,
      daily,
    ];
    bundled = KnowledgeSchema.parse({
      knowledgeVersion: bazi.knowledgeVersion,
      units: [
        ...new Map(
          sources.flatMap((bundle) => bundle.units).map((unit) => [unit.id, unit]),
        ).values(),
      ],
      glossary: [
        ...new Map(
          sources.flatMap((bundle) => bundle.glossary).map((entry) => [entry.key, entry]),
        ).values(),
      ],
      transitions: bazi.transitions,
    });
  }
  return bundled;
}
