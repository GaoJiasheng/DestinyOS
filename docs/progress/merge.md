# merge · 四分支内容合并

## 完成项
- 在 main 按顺序合并 wt/c_tarot、wt/c_astrology、wt/c_vedic、wt/c_daily。
- 四个分支各自产生一个双亲 merge commit，不 squash，不 push。
- 保留四个分支的 T-23 进度文档，逐字节核对与源分支一致。
- 保留全部双语 KU、牌库、术语、覆盖率脚本、真实引擎 fixtures 和回归测试。
- 合并根目录和 content 包的脚本；依赖无新增，重新 pnpm install，lockfile 无需变更。
- 公共重复检测采用精确倒排索引，保留 Dice、0.6 阈值、重复 ID 诊断及输出顺序。
- 保留占星同记录连续筛选、术语体系隔离、塔罗链接保护及每日报告术语匹配器。
- 修复术语总数固定为 600 的集成断言；合并后 612 条均唯一且含完整双语解释。
- 补齐塔罗 9 条、占星 3 条新增术语的拼音及长解释，重新生成 next-intl 目录。
- 合并后的 knowledgeVersion 升至 1.4.0，区分各分支独立语料的 1.3.0。
- 核对 docs/04-engine-overview.md §9 和 birth/F.json：已是农历 1993 年闰三月十五 06:00、成都。
- Fixture F 未发生回退，相关紫微闰月测试通过；无需修改需求文档或引擎 fixture。
- 未修改或提交 .codex-runs/ 中用户已有的文件与改动。

## 未完成项
- 本次合并任务无未完成项。
- 各分支原有人工抽查及相似正文审阅仍待 Owner，详见保留的 T-23 进度文档。

## DESIGN-GAP 列表
- 新增：术语约 600 条为最低基线；合并扩展词条后按数量下限、键唯一性及逐条双语解释验收。
- 保留：精确倒排计数取代逐对文本扫描，不放宽重复检测标准。
- 其余各分支 DESIGN-GAP 保留于对应 T-23 进度文档与源码。

## 如何验证
- pnpm install 通过，Prisma Client 生成成功，依赖和 lockfile 一致。
- 首轮测试 1081/1082 通过；固定 600 条的断言失败已修正并重新执行完整验收。
- pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate 2>/dev/null; pnpm build 全部通过。
- Vitest：34 文件、1,082 用例全部通过；语句/行 99.95%，分支 99.06%，函数 100%。
- 内容校验：3,451 条 KU、612 条术语，零 error；相似度 warning 保持可见。
- pnpm i18n:check 通过，zh/en 键与 ICU 语法一致。
- git diff --check 通过；四分支均为 HEAD 祖先；四个 merge commit 均有两个父提交。
- 无新增 npm 依赖，未引入 AGPL/GPL。
