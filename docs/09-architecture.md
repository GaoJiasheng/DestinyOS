# 09 · 技术架构与工程规范

## 1. 技术栈

| 层 | 选型 | 版本基线 | 说明 |
|---|---|---|---|
| 框架 | Next.js (App Router) | 15.x | SSR + RSC；报告页服务端渲染利于 SEO 与首屏 |
| 语言 | TypeScript | 5.x，`strict: true` | 全仓库，不允许 `any` 逃逸（eslint 规则 error） |
| 包管理 | pnpm workspaces | 9.x | monorepo |
| 构建 | Turborepo | 2.x | 任务缓存 |
| UI | React 19 + Tailwind CSS 4 + shadcn/ui（按需复制组件） | | 自定义 token 覆盖见 03 |
| 动效 | Framer Motion（motion） | 12.x | 页面与组件动效 |
| 3D | Three.js + @react-three/fiber + @react-three/drei | r17x | 仅在星空与星盘场景懒加载 |
| 图表 | 自绘 SVG（D3 scale 工具函数） | | 命盘、雷达图、热力图都是 SVG |
| 状态 | React Server Components 为主；客户端用 Zustand（仅 UI 状态） | | 不引入 Redux |
| 数据获取 | Server Actions + Route Handlers；客户端用 TanStack Query | | |
| 校验 | Zod | 3.x | 所有输入边界 |
| ORM | Prisma + @prisma/adapter-d1 | 6.19.3 | 无 Rust 引擎，D1 Workers adapter |
| 数据库 | Cloudflare D1（SQLite） | | DB binding；本地 SQLite 同 schema |
| 缓存 | Cloudflare KV + Rate Limiting binding | | CACHE 保存可最终一致缓存；token、限额、幂等走 D1 |
| 认证 | Auth.js (next-auth v5) | | Google Provider + Email（Resend） |
| 邮件 | Resend | | 魔法链接、账户事件 |
| 支付 | Stripe | | Checkout + Customer Portal + Webhook |
| 广告 | Google AdSense | | 含 Privacy & messaging CMP |
| 图片生成 | `@vercel/og`（satori）渲染分享卡 | | 边缘函数 |
| 国际化 | next-intl | 3.x | 路由前缀 `/zh` `/en` |
| 测试 | Vitest（单元）、Playwright（E2E） | | 引擎覆盖率 ≥ 90% |
| Lint | ESLint 9（flat）+ Prettier + typescript-eslint | | |
| 部署 | Cloudflare Workers + OpenNext | | 主部署平台；scheduled 每日清理，R2 导出与 Next 缓存 |
| 监控 | Sentry（脱敏规则见 08）+ Workers Observability | | |
| 日志 | pino，JSON | | 禁止记录请求体 |

### 1.1 选型说明

- **为什么不用 LLM 运行时**：决策 D5。所有解读由 `@tianji/interpret` 纯函数生成。
- **为什么 Cloudflare 原生服务**：Owner 决定 D1、KV、R2 与 Workers 作为主路径，不再依赖外部数据库/缓存账号。
- **为什么 Three.js 懒加载**：three + fiber 约 150–200KB gzip，必须在首屏可交互后用 `next/dynamic` + `requestIdleCallback` 载入，详见 03 的性能预算。
- **为什么自绘 SVG 命盘**：命盘排版是领域特定的，图表库帮不上忙；SVG 可服务端渲染、可用于分享图、可打印。

## 2. Monorepo 结构

```
DestinyOS/
├─ apps/
│  └─ web/                      # Next.js 应用（含 admin 路由组）
│     ├─ app/
│     │  ├─ [locale]/           # zh | en
│     │  │  ├─ (marketing)/     # 首页、关于、法律页
│     │  │  ├─ (app)/           # 需要档案的功能页：today、各体系、me
│     │  │  ├─ s/[token]/       # 公开分享页
│     │  │  └─ layout.tsx
│     │  ├─ admin/              # 后台（不加 locale，固定中文，可切英文）
│     │  ├─ api/                # Route Handlers（webhooks、og、export）
│     │  └─ globals.css
│     ├─ components/
│     │  ├─ ui/                 # shadcn 基础组件
│     │  ├─ charts/             # 各体系命盘 SVG 组件
│     │  ├─ three/              # 星空、3D 星盘（client only）
│     │  ├─ report/             # 报告渲染组件（章节、术语卡、原文折叠）
│     │  └─ forms/              # 出生信息表单
│     ├─ lib/                   # 服务端工具：db、auth、crypto、ads、stripe
│     ├─ messages/              # next-intl 文案 zh.json en.json
│     ├─ public/
│     └─ e2e/                   # Playwright
├─ packages/
│  ├─ engine/                   # @tianji/engine 排盘引擎（纯 TS，无 IO）
│  │  ├─ src/
│  │  │  ├─ common/             # 时间、时区、真太阳时、干支、五行基础
│  │  │  ├─ bazi/
│  │  │  ├─ ziwei/
│  │  │  ├─ iching/
│  │  │  ├─ qimen/
│  │  │  ├─ tarot/
│  │  │  ├─ astrology/          # 西方 + 吠陀共用星历与宫位
│  │  │  ├─ numerology/         # 生命灵数（B-10 提前）
│  │  │  └─ index.ts
│  │  └─ test/fixtures/         # 黄金用例 JSON
│  ├─ interpret/                # @tianji/interpret 解读组合引擎（纯 TS）
│  ├─ content/                  # @tianji/content 知识库源文件（YAML）+ 编译脚本 + schema
│  │  ├─ schema/
│  │  ├─ bazi/ ziwei/ iching/ qimen/ tarot/ astrology/ vedic/ numerology/ daily/ glossary/
│  │  └─ scripts/               # 校验、编译、导入 DB、从 DB 导出
│  ├─ shared/                   # @tianji/shared 类型、枚举、Zod schema、常量（品牌配置）
│  └─ config/                   # eslint、tsconfig、tailwind preset
├─ docs/                        # 本设计文档
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ scripts/                     # 一次性脚本（内容生成流水线调用入口）
├─ turbo.json
├─ pnpm-workspace.yaml
└─ package.json
```

### 2.1 包之间的依赖方向

```
shared  ←  engine  ←  interpret  ←  web
shared  ←  content ←  interpret
```

`engine` 与 `interpret` **禁止**依赖 `web`、Prisma、Node 内建模块（除 `crypto` 用于种子哈希）。两者必须能在浏览器运行（供"匿名试算离线模式"与分享图渲染）。

## 3. 关键模块设计

### 3.1 `@tianji/shared`

- `brand.ts`：`{ nameZh: '天机', nameEn: 'DestinyOS', domain: 'tianji.gavin.pub', tagline: {...} }`。品牌名**只能**从这里读取（决策 D18）。
- `enums.ts`：`System`, `Gender`, `HouseSystem`, `Locale`, `Plan`, `ReadingStatus` 等。
- `schemas/`：Zod schema：`BirthInputSchema`, `ReadingRequestSchema`（各体系的 question/spread/method 参数），`ChartSchema` 每体系。
- `types/`：从 Zod 推导的 TS 类型。

### 3.2 `@tianji/engine`

统一入口：

```ts
import { compute } from '@tianji/engine';

const result = compute({
  system: 'bazi',
  birth: normalizedBirth,          // 见 04 的 NormalizedBirth
  options: { school: { ziHour: 'late-zi-next-day' } },
  now?: ZonedDateTime,             // 流年流日用；默认当前
  question?: QuestionInput,        // 占卜类
  seed?: string,                   // 随机类（塔罗、随机起卦）
});
// result: { system, chart, meta: { schoolUsed, engineVersion, warnings[] } }
```

每个体系导出 `computeXxx(input): XxxChart`，并导出 `XxxChartSchema`（Zod）保证输出可校验。`engineVersion` 用于报告缓存失效。

### 3.3 `@tianji/interpret`

```ts
import { interpret } from '@tianji/interpret';

const report = interpret({
  system: 'bazi',
  chart,                        // 来自 engine
  locale: 'zh',
  knowledge: knowledgeBundle,   // 已编译的知识库（内存对象），由 web 层从 DB 或静态文件加载
  context: { now, profileHasTime: true },
});
// report: { sections: [...], scores: {...}, keywords: [...], hits: [{ unitId, weight, evidence }], readability: {...} }
```

详见 05。

### 3.4 `@tianji/content`

- YAML 源文件 + JSON Schema 校验（`pnpm content:validate`）。
- `pnpm content:build` → 编译成 `dist/<system>.<locale>.json`（含索引），供 interpret 加载。
- `pnpm content:import` → 导入本地 SQLite `knowledge_units` 表（供后台编辑）。
- `pnpm content:export` → 从 DB 导出回 YAML（后台编辑后回流 git）。
- 运行时：web 层优先读 DB 中 `status = published` 的最新版本并缓存到 KV（key 含版本号）；DB 不可用时回退到打包进应用的 `dist/*.json`。

### 3.5 web 层数据流（报告生成）

```
POST /api/readings  (Server Action createReading)
 1. Zod 校验输入
 2. 读取用户 BirthProfile（解密）或请求体中的匿名 birth
 3. normalizeBirth() → NormalizedBirth（时区、真太阳时等，见 04）
 4. engine.compute()
 5. loadKnowledge(system, locale, version)
 6. interpret()
 7. 持久化 Reading（inputSnapshot 加密、chart 明文 JSON、report 明文 JSON、knowledgeVersion、engineVersion）
 8. 返回 readingId → 客户端跳转 /[locale]/[system]/r/[readingId]
```

报告页为 RSC：按 `readingId` 读取并渲染，`report` 已是最终文本，不再重算。若用户切换语言，用同一 `chart` 以另一语言重新 interpret（不重新排盘），结果写入 `Reading.reportEn/reportZh` 对应列。

### 3.6 每日运势生成

```
GET /[locale]/today  (RSC)
 1. 取用户档案与时区（用户当前时区由浏览器上报存在 cookie `tz`，缺省用出生地时区）
 2. localDate = today in tz
 3. cacheKey = daily:{userId}:{profileVersion}:{localDate}:{locale}:{knowledgeVersion}
 4. KV hit → 渲染；miss → engine.computeDaily() → interpret('daily') → 写缓存（TTL 到当地次日 02:00）
```

匿名用户：在客户端用 `@tianji/engine` 与打包的知识库直接算（不落库）。

## 4. 环境变量与绑定

| 变量 | 用途 | 必需 |
|---|---|---|
| `DB` | D1 binding（不是 secret） | ✓ |
| `CACHE` / `RATE_LIMITER` | KV 与 Workers Rate Limiting binding | ✓ |
| `LOCAL_DATABASE_URL` | 本地 Node SQLite file URL，Workers 不读取 | 本地 |
| `AUTH_SECRET` | Auth.js | ✓ |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth | ✓ |
| `RESEND_API_KEY` / `EMAIL_FROM` | 邮件 | ✓ |
| `FIELD_ENCRYPTION_KEYS` | 形如 `v2:base64key,v1:base64key`，第一个为当前写入密钥（见 08） | ✓ |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `STRIPE_PRICE_MONTHLY` / `STRIPE_PRICE_YEARLY` | 支付 | ✓ |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-xxxx` | ✓ |
| `NEXT_PUBLIC_SITE_URL` | `https://tianji.gavin.pub` | ✓ |
| `NEXT_PUBLIC_DEFAULT_LOCALE` | `zh` | |
| `FEATURE_LLM_POLISH` | `false` | |
| `FEATURE_ADS` | `true` | |
| `ADMIN_EMAILS` | 逗号分隔，拥有 admin 角色的邮箱 | ✓ |
| `SENTRY_DSN` | 监控 | |
| `CRON_SECRET` | HTTP Cron 路由鉴权；Workers scheduled 复用任务 | ✓ |

`.env.example` 必须列出全部变量并带注释。任何密钥不得进入 `NEXT_PUBLIC_*`。

## 5. 编码规范

- 文件名 kebab-case；React 组件 PascalCase 导出；hooks 以 `use` 开头。
- 所有导出函数有 JSDoc，含参数含义与单位（角度用度、时间用 ISO 字符串 + IANA 时区）。
- 引擎中不使用 `Date` 对象做历法计算，统一用 `Temporal`（通过 `@js-temporal/polyfill`）或库自带类型；禁止隐式本地时区。
- 角度统一 `[0, 360)` 浮点度；经度东正西负；纬度北正南负。
- 干支、五行、星名等用 `@tianji/shared` 的枚举/常量，不散落字符串字面量。
- 用户可见文案一律经 next-intl 的 `t()`；禁止硬编码。
- 错误：引擎抛 `EngineError(code, message, details)`；web 层转为 `ApiError`，code 表见 07。
- Git：Conventional Commits；PR 必须附带相关测试；主分支保护。

## 6. 测试策略

| 层 | 工具 | 要求 |
|---|---|---|
| 引擎 | Vitest | 每体系 ≥ 20 条黄金用例（输入 → 期望 chart 片段），来源：各体系文档「核验」节给出的参考站点结果；覆盖率 ≥ 90% |
| 解读 | Vitest | 对每个体系的 Fixture A 生成报告，断言：章节齐全、字数达标、无未替换占位符、术语表全覆盖、中英都有 |
| 知识库 | 自定义脚本 | schema 校验、触发条件可解析、互斥对冲突检查、双语齐全、禁词扫描（见 05） |
| web | Vitest + Testing Library | 表单校验、时区换算、权限（匿名/登录/会员/admin） |
| E2E | Playwright | 七条主流程（匿名试算→登录→保存→today→分享→订阅→删除），zh/en 各跑一遍，移动端 viewport |
| 视觉 | Playwright 截图对比 | 七个命盘组件 + 首页，容差 0.5% |
| 性能 | Lighthouse CI | 首页、today、八字报告页，移动端 Performance ≥ 85 |

## 7. CI/CD

- GitHub Actions：`lint → typecheck → unit → content:validate → build → e2e(预览环境)`。
- Cloudflare 为主部署路径；CI 构建 OpenNext 与体积检查，不自动发布或写 secrets。
- D1 migration SQL 由 Prisma migrate diff 生成；先本地验证再 `wrangler d1 migrations apply destinyos --remote`。发布 Worker 需独立授权。
- Workers scheduled：`0 3 * * *` 清理过期匿名数据、硬删除到期账户、预热当天热门缓存。

## 8. 性能与体积预算

| 指标 | 预算 |
|---|---|
| 首页首屏 JS（不含 three） | ≤ 180KB gzip |
| three 相关 chunk | ≤ 220KB gzip，idle 后加载 |
| 单页字体 | 中文字体子集化（只打包 UI 常用 3500 字 + 命理术语表），≤ 350KB woff2；英文显示字体 ≤ 60KB |
| 图片 | 塔罗 78 张牌 WebP 每张 ≤ 40KB（600px 高），AVIF 可选 |
| 报告 API | p95 ≤ 600ms（含 DB） |
| 排盘计算 | 单体系 ≤ 200ms；占星星历计算 ≤ 50ms |

## 9. 可观测性

- Sentry：捕获异常；`beforeSend` 脱敏（见 08）。
- 自定义指标（写 D1 `events` 表，日聚合）：报告生成数/体系、每日运势访问、分享生成、订阅转化、失败率。不记录 userId 以外的个人信息。
- 健康检查 `GET /api/v1/health`：D1、KV、知识库版本（保留既有响应键 redis）。

## 10. 本地开发

```bash
pnpm install
cp .env.example .env.local   # 填写
pnpm db:deploy               # Node 本地 SQLite
pnpm db:migrate              # Wrangler 本地 D1
pnpm content:build && pnpm content:import
pnpm dev                      # http://localhost:3000
```

无需 PostgreSQL/Redis Docker 服务。无网络也应能运行排盘与解读（知识库走打包的 dist）。

## CF-NATIVE 平台补充

- 本章节按 Owner 决定覆盖 00 的历史 D16；目录结构保留，D1 迁移放 `apps/web/migrations/`，Prisma schema 保留根目录。
- `apps/web/wrangler.toml`：DB=destinyos、CACHE=destinyos-cache、RATE_LIMITER、EXPORT_BUCKET=destinyos-exports、NEXT_INC_CACHE_R2_BUCKET=destinyos-next-cache、BROWSER、ASSETS。
- Worker 请求内创建 D1 Prisma client；Node 本地开发与浏览器测试使用 SQLite 等价实现。Vitest 增加 Miniflare 真实 D1/KV/adapter 与 Auth.js 单次 token 测试。
- 原生 Rate Limiting binding 仅支持短周期；07 的分路线、IP/邮箱/用户小时滑动限额由 D1 原子 INSERT SELECT 实现，不放宽限额。
- 强一致操作用原子 SQL/DB.batch；敏感列在写入批次前调用现有加密函数。详情见 06 的原生迁移章节。
- `pnpm cf:build` 生成 OpenNext Worker 并在本地打包计算 JS/WASM gzip 总体积；必须 ≤10MiB，不调用 wrangler deploy。
- Vercel renderer/storage 兼容代码保留为本地开发路径；其托管部署不再是验收要求。
