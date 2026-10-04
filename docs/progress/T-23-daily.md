# T-23 · 知识库内容生产 daily

## 完成项
- 发布 daily 双语 KU 279 条，按主题分为 11 个 YAML 文件，knowledgeVersion 1.3.0。
- oneliner 40 个 band×theme 组合各 2 个独立变体；互斥双向、用户稳定选取、双语同选。
- 领域章 134 条：十神×强弱相关领域、喜忌、日支关系、次级冲向、行运与水逆。
- 星象章 54 条：12 月亮星座、8 月相、30 主要行运、3 逆行、1 兜底。
- 今日一牌 3 条、Panchang 6 条、行动总结 1 条；10 章各有 weight 1 弱条件兜底。
- 条件仅使用真实 DailyChart 字段；daily 没有 features，未杜撰布尔特征。
- 正文、summary、建议、Do/Don't、禁词与负面缓冲均通过现有校验。
- 七体系 glossary 600 条（新增 156），全部 zh/en/pinyin/short/long 齐全，保留既有键。
- 补充 common transitions/disclaimer，生成两语言 next-intl glossary/interpretation catalog。
- 倒排索引加速重复扫描；保持原 Dice 阈值与警告顺序，并新增等价性测试。
- 组文复用报告级术语匹配器，跳过不影响选择的 plain 密度预扫描，保留报告密度检查。
- 新增 daily 覆盖脚本及矩阵、兜底、跨语言变体、让步衔接、术语完整性测试。

## 未完成项
- 无自动验收项未完成；人工 5% 抽查未执行，reviewed_by 保持 null。
- daily 3-gram 相似度警告 3058 条（§7 为 warning）；同主题复用需后续编辑审阅，未屏蔽警告。

## DESIGN-GAP 列表
- daily 短评与通用 KU 字数不同：summary 作短摘，body 保留 05 §2 完整长度；未修改校验范围。
- oneLiner 的主题是主导 finding 标签，不总等于流日十神；概览解释主题，领域段落引用实际十神。
- 约 30 行运采用全部 26 条评分行运组合加 4 条 Mercury–Sun 相位，各补对应领域辅助段落。
- 同领域共享 direction topic，八字权重 55–78 高于行运 46–48，反向极性用现有让步算法。
- 每章 date.local exists + weight 1 兜底；缺失可选数据时不补造证据。
- 随机抽样使用 1940–2005 出生、1–28 日、四个时区，独立抽取 2025–2027 目标日。
- 术语扩展沿用 appendix snake_case；vedic 技术词、qimen.flag 使用命名空间。
- 600 术语使八字 24 报告集成耗时增长：该测试单独允许 60s，样本数、断言和覆盖率门槛不变。

## 覆盖统计
- seed: T-23-daily-coverage-v1；A–G + 500 随机合法出生，共 507 命盘、1,014 双语报告。
- 未知时辰 101 个；10 章空洞均 0/1,014（0%），checkCoverage 无缺口。
- zh 7114–10455 字；en 4320–6330 词；可读性问题 0。
- 真实样本命中 209/279 KU，全部非 oneliner 199/199 命中；实际选中 10 个 oneliner 变体。
- 70 条未自然触发均为 oneliner；随机样本无 great，40 根键/80 变体另经完整矩阵测试。

## 如何验证
- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build 全部通过。
- 分批 pnpm content:validate 修正至通过；最终全仓 1,706 KU、600 glossary 校验成功。
- pnpm content:daily:coverage 重现上述统计；任一空章/可读性问题导致非零退出。
- pnpm test：31 文件、1,056 测试全通过；总语句/行覆盖 99.95%，分支 99.06%，函数 100%。
- pnpm i18n:check、git diff --check 通过；未改需求文档，未触碰 .codex-runs，未新增项目依赖。
