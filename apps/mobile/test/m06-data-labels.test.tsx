import { render, renderHook, screen } from '@testing-library/react-native';
import { compute, normalizeBirth } from '@tianji/engine';
import { dataPathLabel, dataValueLabel } from '../lib/reports/data-labels';
import { DataTree, useChartLabel } from '../components/report/report-ui';
import { parseNativeChart, reportSystems } from '../lib/reports/readings';
import { makeChartScene } from '../lib/reports/chart-scene';
import { bundledKnowledge } from '../lib/knowledge/bundled';
import { resources } from '../lib/i18n';
import { usePreferences } from '../lib/preferences';
import A from '../../../packages/engine/test/fixtures/birth/A.json';
import B from '../../../packages/engine/test/fixtures/birth/B.json';

test.each(['zh', 'en', 'zh-TW'] as const)(
  'every ordinary Fixture A chart detail is localized in %s',
  (locale) => {
    usePreferences.setState({ locale });
    const { result } = renderHook(useChartLabel),
      t = result.current;
    const knowledge = bundledKnowledge();
    const foreign = locale === 'en' ? /\p{Script=Han}/u : /[A-Za-z]{2,}/;
    function walk(value: unknown, path = '') {
      if (value && typeof value === 'object') {
        for (const [key, child] of Object.entries(value)) {
          const childPath = path ? `${path}.${key}` : key;
          expect(dataPathLabel(childPath, t)).not.toMatch(foreign);
          if (dataPathLabel(childPath, t).includes(t('report.dataPath')))
            throw new Error(`Missing field label: ${childPath}`);
          walk(child, childPath);
        }
      } else {
        const label = dataValueLabel(
          value,
          path,
          locale,
          t,
          resources[locale].translation,
          knowledge,
        );
        expect(label).not.toMatch(foreign);
        if (label === t('mobile.report.data.values.untranslated'))
          throw new Error(`Missing value label: ${path} = ${String(value)}`);
      }
    }
    for (const system of reportSystems) {
      const chart = parseNativeChart(
        system,
        compute({
          system,
          birth: normalizeBirth(A),
          partnerBirth: normalizeBirth(B),
          now: '2026-10-04T04:00:00Z',
          seed: 'fixture-A',
        }).chart,
      );
      for (const node of makeChartScene(chart, t, {
        division: 'D1',
        layout: 'south',
        northUp: true,
      }).nodes)
        walk(node.detail);
    }
  },
);

test('ordinary pillar details localize paths and enum values while the explicit professional view preserves exact codes', () => {
  usePreferences.setState({ locale: 'zh' });
  const value = {
    stem: 'geng',
    branch: 'wu',
    hiddenStems: [{ stem: 'ding', role: 'main', tenGod: 'zheng_guan' }],
  };
  const view = render(<DataTree value={value} />);
  expect(screen.getByText('天干: 庚')).toBeTruthy();
  expect(screen.getByText('地支: 午')).toBeTruthy();
  expect(screen.getByText('藏干 · 1 · 天干: 丁')).toBeTruthy();
  view.rerender(<DataTree value={value} professional />);
  expect(screen.getByText('stem: geng')).toBeTruthy();
  expect(screen.getByText('hiddenStems.0.stem: ding')).toBeTruthy();
});
