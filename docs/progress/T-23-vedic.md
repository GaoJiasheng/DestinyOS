# T-23 知识库内容生产 · vedic

## 完成项
- 新增 11 个主题 YAML，共 812 条 published KU，zh/en 分别成文，知识库版本 1.3.0。
- 月亮 Nakshatra 27×Pada 4×双变体 = 216，a/b 条件相同、双向互斥、跨语言稳定选择。
- 行星×星座 108、行星×宫 108、Lagna 12、宫主星落宫 144。
- Mahadasha 9、Antardasha 81、Yoga 12、引擎可达尊贵/焦伤/逆行状态 61。
- D9 月亮/金星/Lagna×星座 36；概览月亮星座 12；八章兜底 8、无时辰说明 4、未来次运读表说明 1。
- 每章 weight=1 的兜底使用 noonChart exists；无时辰不补宫位、上升、精细 D9 或次运。
- 所有条件只引用实际 Chart 路径；宫主关联同一行星；次运限制于同一当前大运。
- 新增 Vedic 两个真实引擎 fixture、覆盖率 CLI 与 7 项内容回归测试。
- 3-gram 扫描改为精确倒排计数，保留 Dice、0.6 阈值、诊断顺序；与旧逐对算法对照测试。
- 逐批运行 content:validate，长度问题修复后通过；不新增依赖、不改引擎、路由或枚举。

## 未完成项与编辑限制
- 功能与组合覆盖无缺项；Owner 人工抽查未执行，reviewed_by 保留 null，不冒充人工签审。
- Vedic 仍有 16711 对/语言的 3-gram 相似度警告；共享主题片段与组合模板待人工审稿。
- 警告保留可见，按 §7 属于 warning，未关闭重复检测或降低标准。

## DESIGN-GAP
- 维度逐项计算超出“约 450”估算；优先完整穷举，并增加双变体、D9、兜底和无时辰说明。
- 星宿采用现代生活意象，不编造经典引文；Pada 依据真实恒星区域映射 D9 星座。
- Vedic 没有 features 字段；用现有结构表达，不新增不存在的复合特征。
- 宫主落宫用七颗传统守护星的 OR 分支连接来源宫与目标宫，不虚构 lordHouse。
- 状态只取引擎可达值：节点仅 neutral、月亮没有 enemy；焦伤与逆行不添加不可达组合。
- 当前 when 无日期比较/nextPeriods；未来三次运提供跨大运边界读表方法，不伪造未来条目。
- D9 只在时辰已知时读精细落座；其他情况提供关系与承诺的一般观察。
- 兜底以 noonChart exists 同时涵盖 true/false；关键词复用现有双语 glossary 键。
- 固定 seed=23026005；五时区、20% 未知时辰、随机日期取每月 1–28 日确保合法。
- 完整语料改用倒排索引优化重复扫描，计数仍为原字符 3-gram 集的精确交集。

## 覆盖率统计
- A–G 7 个 + 随机合法出生 500 个 + 1900/2100 边界 2 个 = 509 个命盘、1018 份双语报告。
- 未知时辰 102 个；没有当前大运的范围外命盘 26 个。
- 八章均有正文与 lead，空洞率全部 0%；可读性问题 0，未替换变量 0。
- 中文 5252–9664 字；英文 2908–5346 词；最大术语密度 4.2427/100。
- 自然命中 806/812 条；选中月亮变体 189 条；六条未自然命中不造成空章。
- 未命中：surya/ketu、chandra/guru、mangala/surya、ketu/rahu 当前次运组合；Mula Pada 1 的 a/b。

## 如何验证
- 最终全部通过；全仓 30 个测试文件、1057 项测试成功；覆盖率 statements/lines 99.95%、branches 99.06%、functions 100%。
- pnpm install
- pnpm content:validate（每批与最终全仓扫描）
- pnpm --filter @tianji/content coverage:vedic（A–G + 500 + 边界，双语全流程）
- pnpm lint
- pnpm typecheck
- pnpm test；CPU 竞争时使用同一 test 脚本：pnpm run test --maxWorkers=1（原断言、时限与覆盖率阈值不变）
- pnpm build（编译静态双语 bundle、next-intl 词条、全部包及 Web）
