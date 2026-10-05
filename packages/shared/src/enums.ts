// Values follow docs/06-data-model.md; daily is a persisted System as well.
export const System = {
  bazi: 'bazi',
  ziwei: 'ziwei',
  iching: 'iching',
  qimen: 'qimen',
  tarot: 'tarot',
  astrology: 'astrology',
  vedic: 'vedic',
  numerology: 'numerology',
  daily: 'daily',
} as const;
export type System = (typeof System)[keyof typeof System];
export const Gender = { male: 'male', female: 'female', unspecified: 'unspecified' } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];
export const Locale = { zh: 'zh', en: 'en' } as const;
export type Locale = (typeof Locale)[keyof typeof Locale];
export const Plan = { free: 'free', pro: 'pro' } as const;
export type Plan = (typeof Plan)[keyof typeof Plan];
export const ReadingStatus = { ok: 'ok', failed: 'failed' } as const;
export type ReadingStatus = (typeof ReadingStatus)[keyof typeof ReadingStatus];
export const Role = { user: 'user', admin: 'admin' } as const;
export type Role = (typeof Role)[keyof typeof Role];
export const KuStatus = {
  draft: 'draft',
  published: 'published',
  deprecated: 'deprecated',
} as const;
export type KuStatus = (typeof KuStatus)[keyof typeof KuStatus];
// docs/systems/astrology.md chart schema, including the documented koch option.
export const HouseSystem = {
  placidus: 'placidus',
  whole_sign: 'whole_sign',
  equal: 'equal',
  koch: 'koch',
} as const;
export type HouseSystem = (typeof HouseSystem)[keyof typeof HouseSystem];

// DESIGN-GAP: Unspecified life-stage, solar-term and na-yin keys use glossary pinyin snake case.
export const Stem = {
  jia: 'jia',
  yi: 'yi',
  bing: 'bing',
  ding: 'ding',
  wu_stem: 'wu_stem',
  ji: 'ji',
  geng: 'geng',
  xin: 'xin',
  ren: 'ren',
  gui: 'gui',
} as const;
export type Stem = (typeof Stem)[keyof typeof Stem];
export const Branch = {
  zi: 'zi',
  chou: 'chou',
  yin: 'yin',
  mao: 'mao',
  chen: 'chen',
  si: 'si',
  wu: 'wu',
  wei: 'wei',
  shen: 'shen',
  you: 'you',
  xu: 'xu',
  hai: 'hai',
} as const;
export type Branch = (typeof Branch)[keyof typeof Branch];
export const Element = {
  wood: 'wood',
  fire: 'fire',
  earth: 'earth',
  metal: 'metal',
  water: 'water',
} as const;
export type Element = (typeof Element)[keyof typeof Element];
export const YinYang = {
  yin: 'yin',
  yang: 'yang',
} as const;
export type YinYang = (typeof YinYang)[keyof typeof YinYang];
export const TenGod = {
  bi_jian: 'bi_jian',
  jie_cai: 'jie_cai',
  shi_shen: 'shi_shen',
  shang_guan: 'shang_guan',
  pian_cai: 'pian_cai',
  zheng_cai: 'zheng_cai',
  qi_sha: 'qi_sha',
  zheng_guan: 'zheng_guan',
  pian_yin: 'pian_yin',
  zheng_yin: 'zheng_yin',
} as const;
export type TenGod = (typeof TenGod)[keyof typeof TenGod];
export const LifeStage = {
  chang_sheng: 'chang_sheng',
  mu_yu: 'mu_yu',
  guan_dai: 'guan_dai',
  lin_guan: 'lin_guan',
  di_wang: 'di_wang',
  shuai: 'shuai',
  bing: 'bing',
  si: 'si',
  mu: 'mu',
  jue: 'jue',
  tai: 'tai',
  yang: 'yang',
} as const;
export type LifeStage = (typeof LifeStage)[keyof typeof LifeStage];
export const Calendar = {
  gregorian: 'gregorian',
  lunar: 'lunar',
} as const;
export type Calendar = (typeof Calendar)[keyof typeof Calendar];
export const BranchRelationType = {
  combine: 'combine',
  tri_combine: 'tri_combine',
  clash: 'clash',
  punish: 'punish',
  harm: 'harm',
  break: 'break',
} as const;
export type BranchRelationType = (typeof BranchRelationType)[keyof typeof BranchRelationType];
export const Sign = {
  aries: 'aries',
  taurus: 'taurus',
  gemini: 'gemini',
  cancer: 'cancer',
  leo: 'leo',
  virgo: 'virgo',
  libra: 'libra',
  scorpio: 'scorpio',
  sagittarius: 'sagittarius',
  capricorn: 'capricorn',
  aquarius: 'aquarius',
  pisces: 'pisces',
} as const;
export type Sign = (typeof Sign)[keyof typeof Sign];
export const Planet = {
  sun: 'sun',
  moon: 'moon',
  mercury: 'mercury',
  venus: 'venus',
  mars: 'mars',
  jupiter: 'jupiter',
  saturn: 'saturn',
  uranus: 'uranus',
  neptune: 'neptune',
  pluto: 'pluto',
  north_node: 'north_node',
  chiron: 'chiron',
  lilith: 'lilith',
} as const;
export type Planet = (typeof Planet)[keyof typeof Planet];
export const Aspect = {
  conjunction: 'conjunction',
  sextile: 'sextile',
  square: 'square',
  trine: 'trine',
  opposition: 'opposition',
  semisextile: 'semisextile',
  semisquare: 'semisquare',
  sesquiquadrate: 'sesquiquadrate',
  quincunx: 'quincunx',
} as const;
export type Aspect = (typeof Aspect)[keyof typeof Aspect];
export const Angle = {
  asc: 'asc',
  mc: 'mc',
  dsc: 'dsc',
  ic: 'ic',
} as const;
export type Angle = (typeof Angle)[keyof typeof Angle];
export const Modality = {
  cardinal: 'cardinal',
  fixed: 'fixed',
  mutable: 'mutable',
} as const;
export type Modality = (typeof Modality)[keyof typeof Modality];
export const Element4 = {
  fire: 'fire',
  earth: 'earth',
  air: 'air',
  water: 'water',
} as const;
export type Element4 = (typeof Element4)[keyof typeof Element4];
export const Trigram = {
  qian: 'qian',
  dui: 'dui',
  li: 'li',
  zhen: 'zhen',
  xun: 'xun',
  kan: 'kan',
  gen: 'gen',
  kun: 'kun',
} as const;
export type Trigram = (typeof Trigram)[keyof typeof Trigram];
export const Arcana = {
  major: 'major',
  minor: 'minor',
} as const;
export type Arcana = (typeof Arcana)[keyof typeof Arcana];
export const Suit = {
  wands: 'wands',
  cups: 'cups',
  swords: 'swords',
  pentacles: 'pentacles',
} as const;
export type Suit = (typeof Suit)[keyof typeof Suit];
export const Court = {
  page: 'page',
  knight: 'knight',
  queen: 'queen',
  king: 'king',
} as const;
export type Court = (typeof Court)[keyof typeof Court];
export const Mutagen = {
  lu: 'lu',
  quan: 'quan',
  ke: 'ke',
  ji: 'ji',
} as const;
export type Mutagen = (typeof Mutagen)[keyof typeof Mutagen];
export const Palace = {
  life: 'life',
  siblings: 'siblings',
  spouse: 'spouse',
  children: 'children',
  wealth: 'wealth',
  health: 'health',
  travel: 'travel',
  friends: 'friends',
  career: 'career',
  property: 'property',
  wellbeing: 'wellbeing',
  parents: 'parents',
} as const;
export type Palace = (typeof Palace)[keyof typeof Palace];
export const Ayanamsa = {
  lahiri: 'lahiri',
  raman: 'raman',
  kp: 'kp',
} as const;
export type Ayanamsa = (typeof Ayanamsa)[keyof typeof Ayanamsa];
export const Graha = {
  surya: 'surya',
  chandra: 'chandra',
  mangala: 'mangala',
  budha: 'budha',
  guru: 'guru',
  shukra: 'shukra',
  shani: 'shani',
  rahu: 'rahu',
  ketu: 'ketu',
} as const;
export type Graha = (typeof Graha)[keyof typeof Graha];
export const SolarTerm = {
  li_chun: 'li_chun',
  yu_shui: 'yu_shui',
  jing_zhe: 'jing_zhe',
  chun_fen: 'chun_fen',
  qing_ming: 'qing_ming',
  gu_yu: 'gu_yu',
  li_xia: 'li_xia',
  xiao_man: 'xiao_man',
  mang_zhong: 'mang_zhong',
  xia_zhi: 'xia_zhi',
  xiao_shu: 'xiao_shu',
  da_shu: 'da_shu',
  li_qiu: 'li_qiu',
  chu_shu: 'chu_shu',
  bai_lu: 'bai_lu',
  qiu_fen: 'qiu_fen',
  han_lu: 'han_lu',
  shuang_jiang: 'shuang_jiang',
  li_dong: 'li_dong',
  xiao_xue: 'xiao_xue',
  da_xue: 'da_xue',
  dong_zhi: 'dong_zhi',
  xiao_han: 'xiao_han',
  da_han: 'da_han',
} as const;
export type SolarTerm = (typeof SolarTerm)[keyof typeof SolarTerm];
export const NaYin = {
  hai_zhong_jin: 'hai_zhong_jin',
  lu_zhong_huo: 'lu_zhong_huo',
  da_lin_mu: 'da_lin_mu',
  lu_pang_tu: 'lu_pang_tu',
  jian_feng_jin: 'jian_feng_jin',
  shan_tou_huo: 'shan_tou_huo',
  jian_xia_shui: 'jian_xia_shui',
  cheng_tou_tu: 'cheng_tou_tu',
  bai_la_jin: 'bai_la_jin',
  yang_liu_mu: 'yang_liu_mu',
  quan_zhong_shui: 'quan_zhong_shui',
  wu_shang_tu: 'wu_shang_tu',
  pi_li_huo: 'pi_li_huo',
  song_bai_mu: 'song_bai_mu',
  chang_liu_shui: 'chang_liu_shui',
  sha_zhong_jin: 'sha_zhong_jin',
  shan_xia_huo: 'shan_xia_huo',
  ping_di_mu: 'ping_di_mu',
  bi_shang_tu: 'bi_shang_tu',
  jin_bo_jin: 'jin_bo_jin',
  fu_deng_huo: 'fu_deng_huo',
  tian_he_shui: 'tian_he_shui',
  da_yi_tu: 'da_yi_tu',
  chai_chuan_jin: 'chai_chuan_jin',
  sang_zhe_mu: 'sang_zhe_mu',
  da_xi_shui: 'da_xi_shui',
  sha_zhong_tu: 'sha_zhong_tu',
  tian_shang_huo: 'tian_shang_huo',
  shi_liu_mu: 'shi_liu_mu',
  da_hai_shui: 'da_hai_shui',
} as const;
export type NaYin = (typeof NaYin)[keyof typeof NaYin];
export const EngineErrorCode = {
  E_INVALID_INPUT: 'E_INVALID_INPUT',
  E_DATE_OUT_OF_RANGE: 'E_DATE_OUT_OF_RANGE',
  E_LUNAR_NO_LEAP_MONTH: 'E_LUNAR_NO_LEAP_MONTH',
  E_REQUIRES_BIRTH_TIME: 'E_REQUIRES_BIRTH_TIME',
  E_REQUIRES_PLACE: 'E_REQUIRES_PLACE',
  E_UNSUPPORTED_SCHOOL: 'E_UNSUPPORTED_SCHOOL',
  E_EPHEMERIS: 'E_EPHEMERIS',
  E_ENGINE_INTERNAL: 'E_ENGINE_INTERNAL',
} as const;
export type EngineErrorCode = (typeof EngineErrorCode)[keyof typeof EngineErrorCode];
export const EngineWarningCode = {
  W_DST_PERIOD: 'W_DST_PERIOD',
  W_NO_PLACE: 'W_NO_PLACE',
  W_NO_HOUR_PILLAR: 'W_NO_HOUR_PILLAR',
  W_NOON_CHART: 'W_NOON_CHART',
  // DESIGN-GAP: Explicit warnings for the documented gender fallback and tentative 从格.
  W_GENDER_DEFAULTED: 'W_GENDER_DEFAULTED',
  W_SUSPECTED_CONG: 'W_SUSPECTED_CONG',
  W_HOUSE_SYSTEM_FALLBACK: 'W_HOUSE_SYSTEM_FALLBACK',
} as const;
export type EngineWarningCode = (typeof EngineWarningCode)[keyof typeof EngineWarningCode];

// DESIGN-GAP: Unspecified astronomical identifiers use English snake case; VBody reuses the documented Graha values.
export type Body = Planet;
export type VBody = Graha;
export type AspectType = Aspect;
export const Nakshatra = [
  'ashwini',
  'bharani',
  'krittika',
  'rohini',
  'mrigashira',
  'ardra',
  'punarvasu',
  'pushya',
  'ashlesha',
  'magha',
  'purva_phalguni',
  'uttara_phalguni',
  'hasta',
  'chitra',
  'swati',
  'vishakha',
  'anuradha',
  'jyeshtha',
  'mula',
  'purva_ashadha',
  'uttara_ashadha',
  'shravana',
  'dhanishta',
  'shatabhisha',
  'purva_bhadrapada',
  'uttara_bhadrapada',
  'revati',
] as const;
export type Nakshatra = (typeof Nakshatra)[number];
