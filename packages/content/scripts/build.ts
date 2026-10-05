import { loadRectificationFeatures } from './rectification';
import { compileLearn } from './learn';
import { mkdir, writeFile, readdir, unlink, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { System } from '@tianji/shared';
import type { CompiledBundle } from '../src';
import version from '../version.json';
import { loadContent, printDiagnostics, root } from './load';
const result = await loadContent();
const rectificationFeatures = await loadRectificationFeatures();
printDiagnostics(result.diagnostics);
if (result.diagnostics.some((d) => d.severity === 'error') || !result.transitions)
  process.exitCode = 1;
else {
  await compileLearn(result.glossary);
  const dist = join(root, 'dist');
  await mkdir(dist, { recursive: true });
  // DESIGN-GAP: Remove only prior content bundles, preserving TypeScript build outputs.
  for (const file of await readdir(dist))
    if (
      /^(bazi|ziwei|iching|qimen|tarot|astrology|vedic|numerology|daily|common)\.(zh|en)\.json$/.test(
        file,
      )
    )
      await unlink(join(dist, file));
  for (const system of [...Object.values(System), 'common'] as const)
    for (const locale of ['zh', 'en'] as const) {
      const units = result.units
        .filter(
          (u) => u.meta.status === 'published' && (u.system === system || u.system === 'common'),
        )
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const index: CompiledBundle['index'] = { byId: {}, bySection: {}, byTopic: {} };
      units.forEach((u, n) => {
        index.byId[u.id] = n;
        (index.bySection[u.section] ??= []).push(n);
        (index.byTopic[u.topic] ??= []).push(n);
      });
      // DESIGN-GAP: Locale bundles retain bilingual units to share one typed runtime format.
      const bundle: CompiledBundle = {
        system,
        locale,
        ...version,
        units,
        glossary: result.glossary.filter((g) => g.system === system || g.system === 'common'),
        transitions: result.transitions,
        index,
      };
      await writeFile(
        join(dist, `${system}.${locale}.json`),
        JSON.stringify(bundle, null, 2) + '\n',
      );
    }
  for (const locale of ['zh', 'en'] as const) {
    const dir = join(root, '../../apps/web/messages', locale);
    await mkdir(dir, { recursive: true });
    // Dotted glossary keys are expanded by web's existing toMessages adapter.
    const catalog = Object.fromEntries(
      result.glossary.flatMap((g) =>
        Object.entries(g[locale]).map(([key, value]) => [`glossary.${g.key}.${key}`, value]),
      ),
    );
    await writeFile(join(dir, 'glossary.json'), JSON.stringify(catalog, null, 2) + '\n');
    const messages: Record<string, string> = Object.fromEntries(
      Object.entries(rectificationFeatures).map(([branch, copy]) => [
        `rectification.feature.${branch}`,
        copy[locale],
      ]),
    );
    for (const system of Object.values(System)) {
      const plan: unknown = JSON.parse(
        await readFile(join(root, '../interpret/src/plans', `${system}.json`), 'utf8'),
      );
      if (!Array.isArray(plan)) throw new Error(`Invalid sectionPlan ${system}`);
      for (const section of plan as unknown[]) {
        if (
          !section ||
          typeof section !== 'object' ||
          !('key' in section) ||
          typeof section.key !== 'string' ||
          !('title' in section) ||
          !section.title ||
          typeof section.title !== 'object' ||
          !(locale in section.title)
        )
          throw new Error(`Invalid chapter ${system}`);
        const title: unknown = section.title[locale as keyof typeof section.title];
        if (typeof title !== 'string') throw new Error(`Invalid chapter title ${system}`);
        messages[`report.sections.${system}.${section.key}`] = title;
      }
    }
    for (const [kind, templates] of Object.entries(result.transitions[locale]))
      templates.forEach((text, n) => (messages[`report.transitions.${kind}.template_${n}`] = text));
    Object.assign(
      messages,
      locale === 'zh'
        ? {
            'report.readability.tooShort': '报告篇幅尚未达到完整解读的要求。',
            'report.readability.termDense': '术语较多，可以结合术语解释阅读。',
            'report.readability.unresolvedVariables': '部分解读内容仍需补充。',
          }
        : {
            'report.readability.tooShort':
              'The report does not yet meet the length required for a full reading.',
            'report.readability.termDense':
              'This report uses many terms; their explanations may help.',
            'report.readability.unresolvedVariables':
              'Some interpretation details still need to be completed.',
          },
    );
    await writeFile(join(dir, 'interpretation.json'), JSON.stringify(messages, null, 2) + '\n');
  }
  console.log('Compiled indexed bilingual knowledge bundles and next-intl glossary catalogs.');
}
