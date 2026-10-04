# 13 · 施工计划与任务拆分

> 面向施工模型（Codex / Opus）与人类工程师。每个任务给出：目标、读哪些文档、产出、验收标准、依赖。任务编号 `T-xx`。建议按里程碑顺序执行；同一里程碑内可并行。

## 0. 工作方式

1. 每个任务开一个分支与 PR；PR 描述列出完成的验收项与未完成项。
2. 任务开始前先读 `00-overview.md` 与任务指定的文档节；不要读整个 docs 目录浪费上下文。
3. 任何与文档不一致的实现，在代码注释 `// DESIGN-GAP:` 并在 PR 描述说明。
4. 测试不过不算完成；UI 任务必须附截图（移动 + 桌面、zh + en）。
5. 命理算法任务：先在参考站点手工核对 Fixture 期望值并写入 fixture JSON，再实现。

## 1. 里程碑

| 里程碑 | 内容 | 产出 |
|---|---|---|
| M0 骨架（第 1 周） | monorepo、CI、设计 token、基础页面框架、认证、数据库 | 能登录、空壳页面、部署到 Vercel Preview |
| M1 引擎（第 2–4 周） | 七体系排盘引擎 + 每日引擎 + 黄金用例 | `@tianji/engine` 全部测试通过 |
| M2 知识库与解读（第 3–6 周，与 M1 并行） | KU schema、组合引擎、内容流水线、2500 条 KU 生产与抽查 | 七体系 Fixture A 报告达标 |
| M3 前端体验（第 5–8 周） | 表单、报告页、仪式流程、命盘组件、星空、每日运势、分享 | 七体系可用，zh/en |
| M4 商业化与合规（第 8–9 周） | AdSense、CMP、Stripe、法律页、年龄门槛、导出删除 | 可上线审核 |
| M5 后台与打磨（第 9–10 周） | 后台、性能、E2E、视觉回归、无障碍 | 上线 |

## 2. 任务清单

### M0 骨架

**T-01 初始化 monorepo**
- 读：09 §1–2、§4–5、§10。
- 产出：pnpm workspaces + Turborepo；`apps/web`（Next 15 App Router、TS strict、Tailwind 4、shadcn 初始化）；`packages/shared|engine|interpret|content|config` 空壳含 `package.json`、`tsconfig`、一个导出；ESLint/Prettier；`.env.example`；`docker-compose.yml`；README 开发说明。
- 验收：`pnpm i && pnpm lint && pnpm typecheck && pnpm build` 通过；`pnpm dev` 首页显示品牌名（从 `@tianji/shared/brand`）。

**T-02 设计 token 与全局框架**
- 读：03 §1、§4、§6；02 §2。
- 产出：Tailwind `@theme` token；`data-theme` 切换（east/west/vedic/neutral）；字体自托管子集（先全量，后续子集化任务 T-44）；布局：顶部导航/底部 Tab、页脚、Toast、错误边界、免责声明首访弹层；CSS 星空背景层（无 three）。
- 验收：Storybook 或 `/dev/tokens` 页展示全部 token 与按钮/卡片/chip 组件在三个主题下的样子；Lighthouse a11y ≥ 90。

**T-03 i18n 基建**
- 读：12。
- 产出：next-intl 路由中间件、`messages/zh.json`/`en.json` 骨架（含 12 §3 全部键）、`LocaleSwitch`、`i18n:check` 脚本。
- 验收：`/`、`/zh`、`/en` 行为正确；缺键 CI 失败。

**T-04 数据库与 Prisma**
- 读：06 全文；08 §2。
- 产出：`schema.prisma`、迁移、Prisma Client Extension 自动加解密（含 HKDF 子密钥）、`lib/crypto.ts` 单元测试（AAD 不匹配应失败、密钥轮换读旧写新）。
- 验收：测试通过；`prisma migrate deploy` 在 Neon 分支成功。

**T-05 认证**
- 读：07 §3.1；08 §4；02 §3.10。
- 产出：Auth.js Google + Email（Resend 模板 zh/en）、数据库会话、`/auth/login`、`/auth/verify` 确认按钮、限流（Upstash）。
- 验收：E2E：邮箱登录全流程（用 Resend 测试模式或 mailhog）；Google 登录手测；会话删除后立即失效。

**T-06 Redis、限流、健康检查、日志**
- 读：07 §1、§3.9；09 §9；08 §3。
- 产出：Upstash 客户端、`ratelimit()` helper、`/api/v1/health`、pino + redact、Sentry 初始化 + `beforeSend` 脱敏。
- 验收：单测：日志中含生日字符串的对象被擦除；限流 429 带 `retryAfter`。

### M1 引擎

**T-10 引擎公共层**
- 读：04 全文（重点 §2–§4、§8–§10）；systems/bazi.md §3.1。
- 产出：`@tianji/shared` 枚举/Zod schema（BirthInput、NormalizedBirth、各体系 Chart schema 骨架）；`engine/common`：`normalizeBirth()`（含农历→公历、时区、真太阳时 via `@openfate/true-solar-time` 并有自研 NOAA 回退与对照测试、DST warning）、干支/五行/藏干/十神/纳音/长生/旬空常量与函数、xoshiro 随机、`EngineError`。
- 验收：Fixture A–G 的 `NormalizedBirth` 快照测试；真太阳时 3 城市与 NOAA 计算器误差 ≤ 1 分钟；五虎遁/五鼠遁/十神矩阵全表测试。

**T-11 八字引擎**
- 读：systems/bazi.md 全文；04 §4、§5。
- 产出：`computeBazi()` 基于 lunar-typescript，含 20 神煞、身强弱 `weighted_v1`、格局、喜用、大运/流年/流月、地支关系、`features.*` 布尔特征（供 KU）。
- 验收：Fixture A/B/C/D/E/G 期望值（先手工核对参考站并写入 fixture）；bazi.md §9 单测清单全部通过；覆盖率 ≥ 90%。

**T-12 紫微引擎**
- 读：systems/ziwei.md；04 §4、§10。
- 产出：`computeZiwei()` 封装 iztro（配置 default 四化、fixLeap、真太阳时预处理、timeIndex 映射含晚子时）、输出映射与完整性校验、25 格局检测。
- 验收：Fixture A/B/F 与 iztro 文档站 / ziwei.pub 一致；无时辰抛 `E_REQUIRES_BIRTH_TIME`；格局每条正反例。

**T-13 周易引擎**
- 读：systems/iching.md。
- 产出：64 卦数据合并（freizl + Johnson-Jia → `hexagrams.yaml`，含校对脚本）、梅花三法起卦、互变卦、体用旺衰、六爻摇卦与装卦（纳甲/六亲/世应/六神/伏神/用神/旺衰）、多动爻取用规则。
- 验收：iching.md §9 用例 + 单测清单；与 `liuyao` npm 装卦交叉测试 20 卦。

**T-14 奇门引擎**
- 读：systems/qimen.md；04 §10。
- 产出：先用 Python `kinqimen` 生成 30 个时刻的基准 JSON（脚本入库 `test/fixtures/qimen-baseline/`）；评估 `qimen-dunjia` npm 一致性；一致则封装，否则自研（规则见文档）；格局 40 条、用神判断、方位时机。
- 验收：30 基准全对；qimen.md §8 单测；`findings` 可解释。

**T-15 塔罗引擎**
- 读：systems/tarot.md。
- 产出：78 牌数据骨架（关键词取 corpora CC0，正文留给内容流水线）、8 牌阵定义、seed 抽牌（含 pickedIndices）、统计与 30 组合、每日一牌。
- 验收：tarot.md §9；图片资源任务见 T-36。

**T-16 星历与占星引擎**
- 读：systems/astrology.md；04 §4、§10。
- 产出：astronomy-engine 封装（行星黄经/速度、月相、日出）、ASC/MC、Placidus/Whole Sign/Equal 宫位、相位引擎、统计、守护/互容、相位格局；Lahiri ayanamsa、Nakshatra/Pada、Navamsa、Dignity/Combust、Vimshottari（Maha + Antar）、12 Yoga、Panchang；凯龙近似表 + 标注。
- 验收：Fixture A 与 astro.com 容差（行星 ±0.1°、ASC/MC ±0.3°、宫头 ±0.5°）；Lahiri 2000-01-01 ≈ 23°51′ ±1′；Panchang 2026-10-04 新德里与 Drik Panchang 一致；高纬度 Placidus 回退 warning。

**T-17 每日引擎**
- 读：systems/daily.md；04 §7。
- 产出：`computeDaily()`：流日、行运、每日一牌、Panchang、评分规则表（数据驱动，便于后台调参 P2）、宜忌白名单映射。
- 验收：daily.md §8。

**T-18 引擎浏览器打包验证**
- 读：09 §2.1。
- 产出：`@tianji/engine` 在 Vite 浏览器测试中运行 Fixture A 七体系；体积报告。
- 验收：浏览器全部通过；engine gzip ≤ 350KB（不含星表）。

### M2 知识库与解读

**T-20 KU schema、校验与编译**
- 读：05 §2–§3、§7、§10–§11。
- 产出：`ku.schema.json`、`when` 解析器（JSONPath-lite）、`content:validate`（含 Fixture 路径校验、禁用词、双语、字数、互斥一致）、`content:build`、glossary 编译到 messages。
- 验收：对示例 KU 的正反测试；对错误路径的 KU 报错定位到文件行。

**T-21 解读组合引擎**
- 读：05 §4–§6、§8；各体系文档的章节表。
- 产出：`interpret()`：评估、权重、冲突、分章、组文、过渡、依据、建议去重、术语标记、评分、可读性检查；`sectionPlan` 按体系配置。
- 验收：用 30 条手写测试 KU 对 Fixture A 生成报告，断言章节顺序/互斥处理/让步句/术语标记/确定性（两次输出字节相同）。

**T-22 内容生产流水线**
- 读：05 §8–§9；各体系「知识库维度」节。
- 产出：`gen-plan.ts` 穷举任务清单（约 2500 条）、prompt 模板（每体系一份，含风格指南、术语表、2 条范例、禁用词）、`gen-draft.ts`（模型 API 可配置）、`lint` 回路、抽样审阅清单生成。
- 验收：先对八字 50 条试跑，Owner 审阅通过率 ≥ 80% 再全量。

**T-23 知识库全量生产与审阅**
- 产出：七体系 + daily + common 的 KU YAML 入库；glossary 600 条；64 卦白话；78 牌正文；抽样 5% 人工审阅记录。
- 验收：`content:validate` 通过；覆盖率检查（500 随机档案无空章节）；七体系 Fixture A 报告 zh ≥ 2500 字 / en ≥ 1800 词（占卜类 1200/900）。

**T-24 知识库 DB 导入/导出与运行时加载**
- 读：09 §3.4；06 §5–§6。
- 产出：`import-db`/`export-db`、`KnowledgeRelease` 发布逻辑、Redis bundle 缓存、DB 不可用回退到打包 dist。
- 验收：发布新版本后新报告使用新版本；断开 DB 仍能生成报告。

### M3 前端体验

**T-30 出生信息表单与城市库**
- 读：02 §3.3；07 §3.2、§4；04 §2。
- 产出：`BirthForm`（两步、公历/农历、13 档时辰 + 分钟、时辰未知、城市搜索、手动经纬/时区、DST 提示、性别、高级选项）、GeoNames cities500 预处理脚本与搜索 API、`geo-tz`、年龄门槛阻断页。
- 验收：E2E 填表全流程 zh/en；搜索「北京」「Beijing」「New York」「悉尼」命中；< 13 岁阻断且 cookie 防回退。

**T-31 报告创建流程与持久化**
- 读：07 §3.3；09 §3.5；06。
- 产出：`createReadingAction` 等 Server Actions、匿名本地存储（Web Crypto）、`DivinationLoader` 过场、报告页路由（登录/匿名两种数据源）。
- 验收：匿名算 → 登录 → 导入 → 历史可见；幂等键生效。

**T-32 报告页通用布局**
- 读：02 §3.4；03 §6；05 §6。
- 产出：`ReportLayout`、Headline（雷达动画）、章节导航、`ReportSection` 渲染 blocks（段落/过渡/依据/建议/原文/chart_ref）、术语 chip 弹层、专业视图切换、反馈条、广告槽位（先占位）。
- 验收：用 Fixture A 八字报告渲染截图（移动/桌面/zh/en）；术语弹层键盘可达。

**T-33 八字组件**：四柱光柱、五行环、身强弱标尺、大运轴（点击展开流年）、地支关系图；专业视图全表。验收：截图基线 + 与 chart 数据一致的 DOM 测试。
**T-34 紫微组件**：方格盘（移动缩略/全屏缩放）、宫位详情、三方四正高亮、大限条、流年叠加开关。
**T-35 周易与奇门组件**：起卦流程页（三法 + 六爻摇卦铜钱动效 + 数字键盘）、卦象生成动画、体用表、装卦表；奇门起局参数页、九宫点亮、用神高亮、罗盘。
**T-36 塔罗组件与资源**：从 Wikimedia 下载 78 张 1909 RWS → 裁切/压缩脚本 → `public/tarot/rws/`；牌背设计；牌阵选择、洗牌/切牌/扇形/翻牌仪式、牌阵布局、结果页；音效（默认关）。验收：仪式全流程移动端 ≥ 45fps；seed 可复现。
**T-37 占星与吠陀组件**：`NatalWheel` SVG（重叠错位算法、相位线、点击联动）、行星表/相位表、宫位制切换；南/北印度盘、Nakshatra 卡、Dasha 轴；3D 天球（懒加载、降级）。
**T-38 首页与星空**：Hero（BSC5 预处理 `stars.bin`、Three.js Points shader、此刻天空定向、行星标注、流星、降级）、今日一瞥卡、七体系卡片动效、三步说明、页脚。验收：03 §2.2 性能条件；WebGL 关闭时 CSS 星空正常。
**T-39 每日运势页**：13 区块、日期切换手势、示例态、缓存接入、Panchang 折叠、Do/Don't。
**T-40 分享**：`ShareDialog`、3 模板 @vercel/og 渲染（内嵌字体子集）、revealLevel、公开页 `/s/[token]`、OG 图、HMAC 签名每日卡。验收：revealLevel 0 的 PNG 与页面不含生日（自动化文本检查）。
**T-41 我的与设置**：`/me*` 全部页面、导出 JSON、删除账户流程（软删 + cron 硬删）、主题/音效/动效/时区设置。
**T-42 学习百科**：七体系介绍页、78 牌页、64 卦页、术语页（从 content 生成，ISR），SEO 元数据、sitemap、hreflang。
**T-43 PWA**：manifest、图标、离线首页、安装提示。
**T-44 字体子集化与性能**：pyftsubset 子集脚本、字体分段加载、three 懒加载验证、Lighthouse CI 阈值。

### M4 商业化与合规

**T-50 AdSense 与 CMP**：脚本注入条件、`AdSlot`、Privacy & messaging 配置说明文档、页脚 Do Not Sell 链接、13–17 岁标记、CSP Report-Only 收集域名。验收：免费用户见广告、会员不见；EEA 测试（VPN）弹 CMP。
**T-51 Stripe 订阅**：产品/价格脚本、Checkout、Portal、Webhook 幂等、`/pricing`、`/me/billing`、Stripe Tax。验收：测试模式全流程含取消与到期恢复广告。
**T-52 法律页与免责**：隐私政策（按 08 §6.2 要素，zh/en）、条款（18+、订阅条款）、免责声明、Cookie 说明、GeoNames/字体/图片署名页；首访弹层；报告末尾完整声明。
**T-53 数据权利**：导出接口限流、删除 cron、Feedback 脱敏 cron、审计日志。
**T-54 安全头与 CSP enforce**、依赖许可证检查（白名单）、`pnpm audit` CI。

### M5 后台与打磨

**T-60 后台**：10 文档全部页面；re-auth；审计。
**T-61 统计管道**：Event 写入点（07 列出的事件）、日聚合 cron、仪表盘。
**T-62 E2E 套件**：七条主流程 × zh/en × 移动；视觉回归基线。
**T-63 无障碍审计与修复**：axe 全站；键盘走查；屏幕阅读器抽查（VoiceOver）。
**T-64 上线清单**：08 §7 安全检查；Vercel Pro；域名 tianji.gavin.pub；OAuth consent 切 production；AdSense 审核提交；Sentry 告警；备份演练；回滚方案。

## 3. 给施工模型的提示词模板

```
你是 DestinyOS（天机）项目的施工工程师。仓库根目录有 docs/，这是唯一需求来源。
任务：T-11 八字引擎。
先阅读：docs/00-overview.md（全文）、docs/04-engine-overview.md（§2–§5、§8–§10）、docs/systems/bazi.md（全文）。
约束：
- 只在 packages/engine/src/bazi/** 与 packages/engine/test/** 写代码；需要改 shared 的 schema 时单独说明。
- 不引入 AGPL/GPL 依赖；使用 lunar-typescript。
- 枚举值与字段名以文档为准，不得更名。
- 先把 docs/systems/bazi.md §9 的 Fixture 期望写成 test/fixtures/bazi/*.json（若文档给的期望与参考站点不一致，以参考站点为准并在 PR 说明）。
- 测试覆盖率 ≥ 90%；全部通过后再提交。
- 文档未覆盖的细节选最主流做法，并加 // DESIGN-GAP: 注释。
输出：PR，描述中逐条勾选验收标准，列出 DESIGN-GAP。
```

## 4. 风险与应对

| 风险 | 应对 |
|---|---|
| 排盘与参考站不一致（流派差异） | 以文档流派表为准，UI 标注；在专业视图展示中间量便于用户理解差异 |
| 知识库生成质量不稳 | 先 50 条试跑校准 prompt；lint 回路；覆盖率检查防空章节；上线后用 👍👎 数据迭代 |
| 奇门 npm 库不符预期 | 已给出完整规则可自研；Python 基准先行 |
| 星历自研宫位出错 | 与 astro.com 容差测试；高纬回退 |
| AdSense 审核不过 | 先上线百科内容；避免薄内容页；审核期间不显示广告位 |
| Three.js 性能 | 严格降级条件 + fps 监测自动降级 |
| 品牌名商标风险 | 品牌为配置项，可一键更名 |
| 内容合规（健康/承诺） | 禁用词 CI + 写作规范 + 免责声明三层 |
