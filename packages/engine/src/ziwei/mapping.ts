import { Branch, Stem, type Brightness, type StarKey } from '@tianji/shared';
import { EngineError } from '../common/error';
// DESIGN-GAP: 同音星曜以 _aux / _annual / _doctor 区分，避免天府/天福、天钺/天月等 key 碰撞。
const starNames: Record<string, StarKey> = {
  年解: 'nian_jie',
  紫微: 'zi_wei',
  天机: 'tian_ji',
  太阳: 'tai_yang',
  武曲: 'wu_qu',
  天同: 'tian_tong',
  廉贞: 'lian_zhen',
  天府: 'tian_fu',
  太阴: 'tai_yin',
  贪狼: 'tan_lang',
  巨门: 'ju_men',
  天相: 'tian_xiang',
  天梁: 'tian_liang',
  七杀: 'qi_sha',
  破军: 'po_jun',
  左辅: 'zuo_fu',
  右弼: 'you_bi',
  文昌: 'wen_chang',
  文曲: 'wen_qu',
  禄存: 'lu_cun',
  天马: 'tian_ma',
  擎羊: 'qing_yang',
  陀罗: 'tuo_luo',
  火星: 'huo_xing',
  铃星: 'ling_xing',
  天魁: 'tian_kui',
  天钺: 'tian_yue',
  地空: 'di_kong',
  地劫: 'di_jie',
  劫杀: 'jie_sha',
  天空: 'tian_kong',
  天刑: 'tian_xing',
  天姚: 'tian_yao',
  解神: 'jie_shen',
  阴煞: 'yin_sha',
  天喜: 'tian_xi',
  天官: 'tian_guan',
  天福: 'tian_fu_aux',
  天哭: 'tian_ku',
  天虚: 'tian_xu',
  龙池: 'long_chi',
  凤阁: 'feng_ge',
  红鸾: 'hong_luan',
  孤辰: 'gu_chen',
  寡宿: 'gua_su',
  蜚廉: 'fei_lian',
  破碎: 'po_sui',
  台辅: 'tai_fu',
  封诰: 'feng_gao',
  天巫: 'tian_wu',
  天月: 'tian_yue_aux',
  三台: 'san_tai',
  八座: 'ba_zuo',
  恩光: 'en_guang',
  天贵: 'tian_gui',
  天才: 'tian_cai',
  天寿: 'tian_shou',
  截空: 'jie_kong',
  旬中: 'xun_zhong',
  旬空: 'xun_kong',
  空亡: 'kong_wang',
  截路: 'jie_lu',
  月德: 'yue_de',
  天伤: 'tian_shang',
  天使: 'tian_shi',
  天厨: 'tian_chu',
  长生: 'chang_sheng',
  沐浴: 'mu_yu',
  冠带: 'guan_dai',
  临官: 'lin_guan',
  帝旺: 'di_wang',
  衰: 'shuai',
  病: 'bing',
  死: 'si',
  墓: 'mu',
  绝: 'jue',
  胎: 'tai',
  养: 'yang',
  博士: 'bo_shi',
  力士: 'li_shi',
  青龙: 'qing_long',
  小耗: 'xiao_hao',
  将军: 'jiang_jun',
  奏书: 'zou_shu',
  飞廉: 'fei_lian_doctor',
  喜神: 'xi_shen',
  病符: 'bing_fu',
  大耗: 'da_hao',
  岁破: 'sui_po',
  伏兵: 'fu_bing',
  官府: 'guan_fu',
  岁建: 'sui_jian',
  晦气: 'hui_qi',
  丧门: 'sang_men',
  贯索: 'guan_suo',
  官符: 'guan_fu_annual',
  龙德: 'long_de',
  白虎: 'bai_hu',
  天德: 'tian_de',
  吊客: 'diao_ke',
  将星: 'jiang_xing',
  攀鞍: 'pan_an',
  岁驿: 'sui_yi',
  息神: 'xi_shen_annual',
  华盖: 'hua_gai',
  劫煞: 'jie_sha_annual',
  灾煞: 'zai_sha',
  天煞: 'tian_sha',
  指背: 'zhi_bei',
  咸池: 'xian_chi',
  月煞: 'yue_sha',
  亡神: 'wang_shen',
};
const brightnessNames: Record<string, Brightness> = {
  庙: 'miao',
  旺: 'wang',
  得: 'de',
  利: 'li',
  平: 'ping',
  不: 'bu',
  陷: 'xian',
};
/** Map library Chinese names to stable shared star keys; unknown output is an integrity failure. */
export function mapStar(name: string): StarKey {
  const key = starNames[name];
  if (!key) throw new EngineError('E_ENGINE_INTERNAL');
  return key;
}
/** Map library brightness labels to untranslated enum keys. */
export function mapBrightness(name: string): Brightness {
  const key = brightnessNames[name];
  if (!key) throw new EngineError('E_ENGINE_INTERNAL');
  return key;
}
/** Map Chinese heavenly stem labels to shared keys. */
export function mapStem(name: string): Stem {
  const index = '甲乙丙丁戊己庚辛壬癸'.indexOf(name);
  if (index < 0 || name.length !== 1) throw new EngineError('E_ENGINE_INTERNAL');
  return Object.values(Stem)[index]!;
}
/** Map Chinese earthly branch labels to shared keys. */
export function mapBranch(name: string): Branch {
  const index = '子丑寅卯辰巳午未申酉戌亥'.indexOf(name);
  if (index < 0 || name.length !== 1) throw new EngineError('E_ENGINE_INTERNAL');
  return Object.values(Branch)[index]!;
}
