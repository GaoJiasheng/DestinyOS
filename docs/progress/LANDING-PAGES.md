# LANDING-PAGES — 九个体系落地页

状态：完成（2026-11-09），基线 main fc7f4c8。
`/{locale}/{bazi|ziwei|iching|qimen|tarot|astrology|vedic|numerology|synastry}` 三语全部接入。

## 路由接法

- bazi、ziwei、astrology、vedic、numerology：`(marketing)/[system]/page.tsx`，`SystemLandingHero` + `SystemLandingBody`，开始按钮进 `/{system}/new`。
- iching：页面自带 h1 改为 Hero（h1“周易”），原方法卡片（h2“选择起卦方式”）放在 Hero 与 Body 之间，开始按钮锚到 `#system-tool`。
- tarot、qimen：工具自身持有 h1，保持在页面顶部；工具下方接 `SystemLandingBridge`（h2“了解塔罗”、一句话、需要准备、回到工具的开始按钮）+ Body。
- synastry：`SynastryForm` 是 `ssr:false`，静态 HTML 拿不到它的 h1，所以页面放 Hero（h1），表单 h1 改 h2，`/synastry` 从 noindex 改为公开元数据。
- 已删除上一轮的 `(app)/bazi/page.tsx`。

## 文案与生成

- `apps/web/messages/{zh,en}/landing.json`：嵌套结构，手写。
- `apps/web/messages/zh-TW/landing.json`：由 `scripts/i18n-traditional.ts` 用 OpenCC 生成并提交（跳过 href），不在运行时转换。
- `lib/system-landing.ts` 提供类型与读取；`public-seo.ts` 用 `landing.*.seo` 作为 `/{system}` 的标题和描述（OG/canonical/hreflang 沿用 `publicMetadata`），`sitemap.ts` 纳入 qimen、synastry。
- `font-coverage.py`、`font-traditional-subsets.py`、`og-font-subset.py` 改为递归读取嵌套 JSON。

## 内容核对依据

逐条对照 `docs/systems/*.md`、`packages/engine`、`packages/content`、`birth-form` 等实际实现；
样例由引擎对虚构输入实跑（bazi 1924-02-19 16:00 上海，得甲子 丙寅 戊辰 庚申），摘录知识库实际输出。

## 检查

- `apps/web/test/system-landing.test.ts`：九体系 × 三语区块、FAQ JSON-LD、延伸阅读路径、zh-TW 结构、禁词、九路由元数据。
- `scripts/polish-content-audit.ts` 把落地页纳入禁词审计，写入 `test-results/polish/content-audit.json`。
