# T-23 · 知识库内容生产 · iching

完成日期：2026-10-05；分支：wt/c_iching；knowledgeVersion / interpretVersion：1.1.0。

## 完成项
- 分主题完成 313 条 published 双语 KU；zh/en 分别组织正文、例子和建议。
- 维度 KU 280 条：本卦 64、体用 5×8×2 变体 80、季节旺衰 5、用神 9×8 72、真实 findings 19、评价×类别 40。
- 章节补充 33 条：兜底 6、动爻数量规则 7、专业视图 2、类别概览 8、互卦/变卦关系 10。
- 六章均有弱条件、权重 1 的兜底；无动爻与六爻全动均有独立说明。
- 补全 64 卦白话、384 爻白话、每卦三个双语关键词及八类问题指引。
- 保留全部古文、卦序、阴阳线、上下卦和用九/用六字段，已与 HEAD 原始数据逐字段核对。
- 增加三个双语术语及 next-intl 目录；新增卦数据字数、非空、禁词检查。
- 相似度扫描预计算 3-gram 集合，保留原来的 0.6 阈值与警告级别。
- 修复解释器变体选择：用户 ID 稳定散列；匿名按命盘稳定；中英选择一致且不叠加。

## 未完成项
- 无本任务内容维度或必跑验证缺项；未冒认外部人工审核，reviewed_by 仍为 null。
- 保留 1,520 对 3-gram 相似度警告，按 §7 属非阻断提示；中英完全相同正文均为 0 对。

## DESIGN-GAP
- 文档维度写 iching.primary.number，实际 Chart 根路径是 primary.number。
- 英文“150/60 字”按词数；白话卦义容差 140–180，逐爻容差 55–90；中文按字符。
- 现有 keywords 是三个字符串，用“中文 / English”保存双语，不改字段结构。
- KU schema 无 variant 字段，采用 .a/.b ID 与双向互斥；运行时散列选择。
- InterpretContext 原来无 userId，增加可选字段；匿名以命盘为稳定输入，不新增身份存储。
- 用神 schema 有 9 状态；moving/return_* 当前由 findings 承载，兼容状态 KU 同时保留。
- 文档 findings 约 40，实际源码只有 19 个规则键，全部覆盖且不虚构 features。
- 互卦/变卦关系跟随引擎：对应原用位同侧的三爻卦与原体卦比较。
- 易经不依赖出生数据，覆盖检查采用随机合法起卦参数、时刻和四个显式时区。

## 覆盖统计
- 固定 seed：t23-iching-coverage-v1；A–G fixtures 7 + 随机起卦 500 = 507 个合法命盘。
- 梅花 255、六爻 252；双语报告 1,014；64 卦、0–6 条动爻、五种 verdict 均进入样本。
- overview / hexagram / moving_lines / process_outcome / advice / pro_view：空洞率均 0%。
- 1,014 / 1,014 报告可读性通过；最低中文 3,819 字、英文 2,044 词。
- 所有真实 when 路径均通过 fixture 解析；组合维度穷举检查通过。

## 如何验证
- 分批及最终执行 pnpm content:validate：314 KU（含 common.disclaimer）/ 444 术语，零 error。
- pnpm exec tsx scripts/iching-content-audit.ts：执行矩阵、兜底、engine + interpret 双语覆盖检查。
- pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build 均通过。
- pnpm test：23 个测试文件、1,001 项测试通过；覆盖率门槛通过。
- pnpm i18n:check：zh/en 键与 ICU 语法通过；git diff --check 通过。
