任务：T-23 知识库内容生产 · qimen。
阅读：docs/05-interpretation-engine.md §2、§7、§8（写作规范必须逐条遵守）；docs/systems/qimen.md 的「报告章节」与「知识库维度」节；packages/content 现有 schema、validate 脚本与示例 KU。
要做：在 packages/content/qimen/ 下按主题分文件编写 KU YAML，覆盖该体系文档「知识库维度」列出的全部组合（目标约 220 条），每条 zh 与 en 各自成文（不是翻译），字数、结构、语气、禁用词严格按 §8；高频 KU（用神落宫吉凶）各写 2 个变体；when 条件只用 Chart schema 中真实存在的路径与 features.* 布尔特征（先查 packages/shared 中该体系 schema 与 packages/engine 的 features）；为每章提供至少一条泛化兜底 KU（弱条件、低权重）保证任何命盘都不出现空章节。分批写入并每批运行 `pnpm content:validate`，全部通过。最后运行覆盖率检查（packages/content 的 checkCoverage 或自行对 50 个随机合法出生数据跑 engine+interpret）并把统计写入 progress 文档。
