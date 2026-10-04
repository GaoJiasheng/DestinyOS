# T-23 · 知识库内容生产 · qimen

完成项：
- `packages/content/qimen/` 新增 12 个主题文件、225 条 published 双语 KU。
- 17 个用神 × 支持/牵制 × a/b，共 68 条；相同条件、双向互斥，按用户稳定选择变体。
- 覆盖 40 格局、8 标记、8 值使门、9 值符星、8 八神、40 判定 × 类别组合。
- 补齐 16 类别生克说明、8 方位、12 时段、2 阴阳遁概览及六章低权重兜底。
- 条件仅使用真实 Chart 路径；没有虚构 category 或 features 字段；知识版本升至 1.0.1。
- 新增真实奇门 fixture、维度/变体/双语报告测试及可复现覆盖率命令。
- 相似度扫描预计算指纹，保留原算法、0.6 阈值及全部警告；测试区分错误与规范允许的警告。

未完成项：
- 无请求范围内的实现或章节覆盖缺口。
- 人工审阅尚未进行，reviewed_by 保持 null；1648 条相似度警告仍需编辑复核，未隐藏或降阈值。

DESIGN-GAP：
- 用 required castAt.local 作弱条件兜底，不要求未预计算的复合特征。
- 用引擎各类别独有的 useGods 组合识别类别；Chart 不提供 category。
- 支持组要求吉门/吉星/吉格且无指定牵制；牵制组要求至少一项牵制，其余走兜底。
- 门星神与标记的叙述使用主流象征释义；格局以现有规则表为条件与极性依据，不新增评分规则。
- findings 生克为全局汇总，不把它指认到某一个用神或关系方向。
- 地支候选时段采用当地常规两小时窗口，不虚构未来吉日或真太阳时钟点。
- 匿名变体按 chart JSON 稳定选择；已登录调用方可传 context.userId。
- Fixture E 无出生钟点，以明确的中午起局测试覆盖，不冒充已知出生时刻。

如何验证：
- 已实际运行并通过 pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build。
- 分批运行 content:validate 并修复字数错误；最终 226 KU（含 common.disclaimer）、441 术语通过。
- pnpm test：23 文件、1003 测试通过；行/语句 99.95%，分支 99.05%，函数 100%。
- pnpm content:qimen:coverage：种子 T-23-qimen-coverage-v1；A–G + 500 合法随机出生数据。
- 507 张实际 engine 命盘、1014 份 zh/en interpret 报告；六章空洞率均为 0%，可读性失败 0。
- 报告中文 4874–6628 字，英文 2807–3753 词；68 个用神变体均被选中。
- 自然条件命中 212/225 KU、29/40 判定类别；未随机命中的 13 条不造成章节缺口。
- 未命中格局为 ren_dun、long_dun；判定为 career/love/health/travel/exam/lost/general 的 auspicious，以及 wealth/health/travel/exam 的 inauspicious。
- 章节 KU 数：overview 43、use_gods 93、patterns 49、directions_timing 21、advice 9、pro_view 10。
