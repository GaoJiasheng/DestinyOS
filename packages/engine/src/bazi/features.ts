import type { BaziChart, BaziFeatures } from '@tianji/shared';
import { pillarEntries } from './pillars';
import { STEM_ELEMENTS } from '../common/ganzhi';
/** Precomputes boolean KU triggers; only natal evidence is used (no runtime YAML arithmetic). */
export function computeFeatures(chart: Omit<BaziChart, 'features'>): BaziFeatures {
  const entries = pillarEntries(chart.pillars);
  const gods = entries.flatMap(([key, p]) => [
    ...(key === 'day' ? [] : [p.tenGod]),
    ...p.hiddenStems.map((h) => h.tenGod),
  ]);
  const count = (...names: string[]) => gods.filter((g) => names.includes(g)).length;
  const trine = (branch: string) =>
    chart.relations.branches.some(
      (r) => r.type === 'tri_combine' && r.complete && r.branches.some((b) => b === branch),
    );
  // DESIGN-GAP: heavy = ≥3 stem/hidden occurrences, wealth-heavy weakness = ≥3 wealth stars; presence is symbolic, not a second strength score.
  return {
    // At least three 比肩 occurrences outside the day stem itself.
    bi_jian_heavy: count('bi_jian') >= 3,
    // At least three 劫财 occurrences.
    jie_cai_heavy: count('jie_cai') >= 3,
    // Both 正官 and 七杀 exist in visible or hidden stems.
    guan_sha_hun_za: count('zheng_guan') > 0 && count('qi_sha') > 0,
    // Wealth-heavy natal configuration and weighted_v1 weakness coincide.
    cai_duo_shen_ruo: count('zheng_cai', 'pian_cai') >= 3 && chart.strength.level === 'weak',
    // Output and wealth stars coexist; no transformation is inferred.
    shi_shang_sheng_cai: count('shi_shen', 'shang_guan') > 0 && count('zheng_cai', 'pian_cai') > 0,
    // 伤官 and 正官 coexist.
    shang_guan_jian_guan: count('shang_guan') > 0 && count('zheng_guan') > 0,
    // 七杀 and resource stars coexist.
    sha_yin_xiang_sheng: count('qi_sha') > 0 && count('zheng_yin', 'pian_yin') > 0,
    // At least three resource stars.
    yin_xing_heavy: count('zheng_yin', 'pian_yin') >= 3,
    // At least three wealth stars.
    cai_xing_heavy: count('zheng_cai', 'pian_cai') >= 3,
    // A natal hidden stem shares the day-master element.
    has_root: entries.some(([, p]) =>
      p.hiddenStems.some((h) => STEM_ELEMENTS[h.stem] === chart.dayMaster.element),
    ),
    // Rootless score ≤−6 is a tentative 从格 marker only.
    suspected_cong: chart.pattern.notes.includes('bazi.rules.suspected_cong'),
    // Complete 寅午戌; half combinations do not satisfy this trigger.
    san_he_huo_ju: trine('wu'),
    // Complete 申子辰.
    san_he_shui_ju: trine('zi'),
    // Complete 亥卯未.
    san_he_mu_ju: trine('mao'),
    // Complete 巳酉丑.
    san_he_jin_ju: trine('you'),
    // Any natal 六冲 pair.
    has_clash: chart.relations.branches.some((r) => r.type === 'clash'),
    // Any natal 三刑 or 自刑 relation.
    has_punishment: chart.relations.branches.some((r) => r.type === 'punish'),
    // A 桃花 hit by year/day branch.
    has_tao_hua: chart.shenSha.some((s) => s.name === 'tao_hua'),
    // An 驿马 hit by year/day branch.
    has_yi_ma: chart.shenSha.some((s) => s.name === 'yi_ma'),
    // At least one element contributes zero distribution weight.
    missing_element: Object.values(chart.elements.raw).some((n) => n === 0),
    // Independent seasonal temperature correction was selected.
    tiao_hou_needed: chart.useGod.tiaoHou !== undefined,
    // Day-branch xun-void flag, normally false by construction.
    day_branch_void: chart.pillars.day.isVoid,
    // The month-main hidden stem is exposed outside the day stem.
    month_main_exposed: chart.pattern.viaStem,
  };
}
