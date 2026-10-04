# 附录 A · 术语对照表（节选规范 + 全量生成规则）

> 完整 glossary 约 600 条，以 `packages/content/glossary/*.yaml` 为唯一来源（T-23 生产）。本文给出：每个 key 的命名规则、各体系核心词的 zh / en / 拼音 / 一句话解释，供施工模型统一枚举值与显示名。

## 命名规则
- key 为英文 snake 或拼音 snake，全小写；天干地支用拼音；星曜用拼音；西方概念用英文。
- 冲突处理：天干「戊」`wu_stem`，地支「午」`wu`；天干「己」`ji`，紫微化忌 `ji` 放在 `mutagen.ji` 命名空间下不冲突。

## 通用

| key | zh | en | pinyin | 一句话 |
|---|---|---|---|---|
| `element.wood` | 木 | Wood | mù | 生长、伸展、仁 |
| `element.fire` | 火 | Fire | huǒ | 热情、表达、礼 |
| `element.earth` | 土 | Earth | tǔ | 稳定、承载、信 |
| `element.metal` | 金 | Metal | jīn | 决断、规则、义 |
| `element.water` | 水 | Water | shuǐ | 智慧、流动、智 |
| `stem.jia` … `stem.gui` | 甲乙丙丁戊己庚辛壬癸 | Jia … Gui (Heavenly Stems) | | 十天干 |
| `branch.zi` … `branch.hai` | 子丑寅卯辰巳午未申酉戌亥 | Zi … Hai (Earthly Branches) | | 十二地支 |
| `yin` / `yang` | 阴 / 阳 | Yin / Yang | | |
| `solar_term.*` | 立春…大寒 | Start of Spring … Major Cold | | 二十四节气 |
| `apparent_solar_time` | 真太阳时 | apparent solar time | | 按出生地经度和均时差修正后的时间 |

## 八字

| key | zh | en | 一句话 |
|---|---|---|---|
| `day_master` | 日主 | Day Master | 出生日的天干，代表你自己 |
| `pillar.year/month/day/hour` | 年柱/月柱/日柱/时柱 | Year/Month/Day/Hour Pillar | |
| `hidden_stem` | 藏干 | Hidden Stem | 地支里暗藏的天干 |
| `ten_god.bi_jian` | 比肩 | Friend | 与你同类同性的能量：同伴、自我 |
| `ten_god.jie_cai` | 劫财 | Rob Wealth | 同类异性：竞争、花钱 |
| `ten_god.shi_shen` | 食神 | Eating God | 你生出的同性：才艺、享受 |
| `ten_god.shang_guan` | 伤官 | Hurting Officer | 你生出的异性：表达、叛逆 |
| `ten_god.pian_cai` | 偏财 | Indirect Wealth | 你克的同性：外财、机会 |
| `ten_god.zheng_cai` | 正财 | Direct Wealth | 你克的异性：正财、务实 |
| `ten_god.qi_sha` | 七杀 | Seven Killings | 克你的同性：压力、魄力 |
| `ten_god.zheng_guan` | 正官 | Direct Officer | 克你的异性：规则、责任 |
| `ten_god.pian_yin` | 偏印 | Indirect Resource | 生你的同性：直觉、独学 |
| `ten_god.zheng_yin` | 正印 | Direct Resource | 生你的异性：学识、庇护 |
| `strength.strong/balanced/weak` | 身强/中和/身弱 | Strong/Balanced/Weak Day Master | 日主力量 |
| `use_god` | 喜用神 | Favorable Element(s) | 对你有利的五行 |
| `avoid_god` | 忌神 | Unfavorable Element(s) | |
| `na_yin.*` | 纳音（如 路旁土） | Na Yin (Roadside Earth) | 六十甲子的五行意象 |
| `life_stage.*` | 十二长生（长生…养） | Twelve Life Stages (Growth … Nurture) | |
| `void` | 空亡 | Void | 力量落空的地支 |
| `shensha.tian_yi` 等 | 天乙贵人… | Nobleman Star… | 神煞 |
| `luck_pillar` | 大运 | Luck Pillar (10-year) | |
| `annual_pillar` | 流年 | Annual Pillar | |
| `monthly_pillar` | 流月 | Monthly Pillar | |
| `pattern.zheng_guan_ge` 等 | 正官格… | Direct Officer Structure… | 格局 |
| `relation.combine/clash/punish/harm/break/tri_combine` | 六合/六冲/相刑/相害/相破/三合 | Combination/Clash/Punishment/Harm/Break/Trine | 地支关系 |

## 紫微斗数

| key | zh | en | 一句话 |
|---|---|---|---|
| `palace.life` … `palace.parents` | 命宫、兄弟、夫妻、子女、财帛、疾厄、迁移、交友、官禄、田宅、福德、父母 | Life, Siblings, Spouse, Children, Wealth, Health, Travel, Friends, Career, Property, Wellbeing, Parents Palace | 十二宫 |
| `body_palace` | 身宫 | Body Palace | 后天侧重 |
| `star.zi_wei` 等 14 主星 | 紫微、天机、太阳、武曲、天同、廉贞、天府、太阴、贪狼、巨门、天相、天梁、七杀、破军 | Zi Wei (Emperor), Tian Ji (Strategist), Tai Yang (Sun), Wu Qu (General), Tian Tong (Harmony), Lian Zhen (Integrity), Tian Fu (Treasurer), Tai Yin (Moon), Tan Lang (Desire), Ju Men (Gate), Tian Xiang (Minister), Tian Liang (Elder), Qi Sha (Warrior), Po Jun (Breaker) | 英文括注为意译，首次出现后用拼音 |
| `mutagen.lu/quan/ke/ji` | 化禄/化权/化科/化忌 | Prosperity / Power / Fame / Obstacle transformation | 四化 |
| `brightness.*` | 庙旺得利平不陷 | Temple, Prosperous, Gain, Benefit, Neutral, Weak, Fallen | 星曜亮度 |
| `five_elements_class.*` | 水二局…火六局 | Water-2 … Fire-6 Bureau | |
| `decadal` / `yearly` | 大限 / 流年 | Decade Period / Annual Period | |
| `san_fang_si_zheng` | 三方四正 | Triangle & Opposition palaces | 命、财、官 + 迁 |

## 周易

| key | zh | en | 一句话 |
|---|---|---|---|
| `trigram.qian/dui/li/zhen/xun/kan/gen/kun` | 乾兑离震巽坎艮坤 | Heaven, Lake, Fire, Thunder, Wind, Water, Mountain, Earth | 八卦 |
| `hexagram.1` … `hexagram.64` | 乾…未济 | The Creative … Before Completion（Wilhelm 译名） | |
| `primary/changing/mutual` | 本卦/变卦/互卦 | Primary / Resulting / Nuclear hexagram | |
| `moving_line` | 动爻 | Moving line | |
| `body/use` | 体/用 | Self / Subject trigram | 梅花 |
| `six_relative.*` | 父母、兄弟、子孙、妻财、官鬼 | Parents, Siblings, Offspring, Wealth, Officer | 六亲 |
| `six_spirit.*` | 青龙、朱雀、勾陈、腾蛇、白虎、玄武 | Azure Dragon, Vermilion Bird, Hook Snake, Soaring Serpent, White Tiger, Black Tortoise | 六神 |
| `shi/ying` | 世/应 | Self line / Other line | |
| `fu_shen` | 伏神 | Hidden line | |

## 奇门遁甲

| key | zh | en |
|---|---|---|
| `dun.yang/yin` | 阳遁/阴遁 | Yang / Yin Escape |
| `ju` | 局 | Formation (1–9) |
| `star.tian_peng` 等九星 | 天蓬、天芮、天冲、天辅、天禽、天心、天柱、天任、天英 | Peng, Rui, Chong, Fu, Qin, Xin, Zhu, Ren, Ying (Nine Stars) |
| `gate.xiu/sheng/shang/du/jing/si/jing2/kai` | 休生伤杜景死惊开 | Rest, Life, Harm, Delusion, Scenery, Death, Fear, Open (Eight Gates) |
| `deity.zhi_fu/teng_she/tai_yin/liu_he/bai_hu/xuan_wu/jiu_di/jiu_tian` | 值符、腾蛇、太阴、六合、白虎、玄武、九地、九天 | Chief, Serpent, Moon, Harmony, Tiger, Tortoise, Earth, Heaven (Eight Deities) |
| `zhi_fu/zhi_shi` | 值符/值使 | Chief Star / Chief Gate |
| `xun_shou` | 旬首 | Decade leader |
| `pattern.*` | 青龙返首、飞鸟跌穴… | Dragon Returns, Bird Falls into Nest… |

## 塔罗

| key | zh | en |
|---|---|---|
| `arcana.major/minor` | 大阿卡纳/小阿卡纳 | Major / Minor Arcana |
| `suit.wands/cups/swords/pentacles` | 权杖/圣杯/宝剑/星币 | Wands / Cups / Swords / Pentacles |
| `court.page/knight/queen/king` | 侍从/骑士/王后/国王 | Page / Knight / Queen / King |
| `major_00_fool` … `major_21_world` | 愚人…世界 | The Fool … The World |
| `reversed` | 逆位 | Reversed |
| `spread.*` | 牌阵名 | 见 systems/tarot.md §3 |

## 西方占星

| key | zh | en |
|---|---|---|
| `sign.aries` … | 白羊…双鱼 | Aries … Pisces |
| `body.sun/moon/mercury/venus/mars/jupiter/saturn/uranus/neptune/pluto/north_node/chiron/lilith` | 太阳、月亮、水星、金星、火星、木星、土星、天王星、海王星、冥王星、北交点、凯龙星、莉莉丝 | |
| `angle.asc/mc/dsc/ic` | 上升/天顶/下降/天底 | Ascendant / Midheaven / Descendant / Imum Coeli |
| `house.1` … `house.12` | 第一宫…第十二宫 | 1st … 12th House |
| `aspect.conjunction/sextile/square/trine/opposition` | 合相/六分相/四分相/三分相/对分相 | |
| `element4.fire/earth/air/water` | 火/土/风/水 | |
| `modality.cardinal/fixed/mutable` | 基本/固定/变动 | |
| `house_system.placidus/whole_sign/equal/koch` | 普拉西度/整宫/等宫/科赫 | |
| `big_three` | 太阳月亮上升 | Big Three |

## 吠陀

| key | zh | en |
|---|---|---|
| `rashi.*` | 十二星座（梵名）| Mesha … Meena |
| `nakshatra.ashwini` … 27 | 阿湿毗尼…（27 星宿，站内用梵名音译 + 中文别名） | Ashwini … Revati |
| `pada` | 帕达 | Pada (quarter) |
| `lagna` | 上升 | Lagna |
| `graha.*` | 九曜：日月火水木金土、罗睺、计都 | Surya, Chandra, Mangala, Budha, Guru, Shukra, Shani, Rahu, Ketu |
| `dasha.maha/antar` | 大运/次运 | Mahadasha / Antardasha |
| `navamsa` | 九分盘 | Navamsa (D9) |
| `dignity.*` | 旺/落/自宫/三分 | Exalted / Debilitated / Own / Moolatrikona |
| `combust` | 焦伤 | Combust |
| `yoga.*` | 瑜伽格局 | Gajakesari, Budha-Aditya … |
| `panchang.tithi/nakshatra/yoga/karana/vara` | 月日/星宿/瑜伽/半日/星期 | Tithi / Nakshatra / Yoga / Karana / Vara |
| `ayanamsa.lahiri` | 拉希里岁差 | Lahiri ayanamsa |
