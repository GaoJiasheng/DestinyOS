# UX-FIX-1 线上走查缺陷修复

验证环境：`next dev`（端口 3186），Playwright Chromium 全新上下文；机器负载 200–800，耗时偏大。

## 1. 就地确认（18 岁 + 免责声明）

- `lib/consent.ts` 是共用状态：`ensureConsent()` / `afterConsent()`；`components/consent/consent-host.tsx` 挂在根布局，
  `consent-dialog.tsx` 按需加载，分块加载失败时退回 `window.confirm`，不会跳过确认。
- 覆盖入口：`BirthForm` 最终提交（八字、紫微、占星、吠陀、合盘匿名录入、定盘录入、档案保存）、`NumerologyForm`、
  `SynastryForm` 提交、`RectificationWizard` 推算、`TarotSelection` 开始抽牌、`DivinationFlow`（周易、奇门，含"一次掷完"）、
  导航一键起盘 `launchSystem`（有已存档案时）。
- 确认在业务的 busy 状态之外等待；取消则留在原表单，输入不变。无效日期和未满 13 岁仍走原逻辑，不先弹确认。
- 按出生日期的限制（`E_AGE_RESTRICTED` → `age_gate` → `/age-restricted`）未改动。
- 与上一轮的差异：提示条"我知道了"只写 `tianji-disclaimer-notice-v1`，**不再算作确认**（文案没有确认年龄）。
  `tianji-disclaimer-v1` / `disclaimerAcceptedAt` 只由对话框写入；老用户不受打扰。
- 确认仅在客户端，与原弹窗一致；服务端不校验。

## 2. /zh/today、/zh/tarot 停在"正在加载" —— 最新代码未复现

- 全新上下文、无 localStorage、未点击任何确认：正文出现（route-skeleton 消失且正文非加载文案），
  路由编译完成后 375px /zh/today 7.3 秒、/zh/tarot 11.7 秒，控制台无 error。
- 只覆盖 dev 的 worker 计算路径。Cloudflare 构建特有的 `NEXT_PUBLIC_STATIC_ASSETS` 示例快照分支未实测。
- 线上旧版为何卡住没有定论。`calculateDailyInWorker` 没有超时，worker 启动后一直不返回时页面会一直 loading（代码阅读，未改）。

## 3. charts.* 客户端消息

- `/today` 走 `dailyMessages`（含完整 `charts`），日历走 `featureMessages`，aspect / angle / sign / graha / panchang 都在，无缺失。
- 根布局 `shellMessages` 只需 `charts.planet`（星空画布），不扩大公开 HTML。
- `test/client-messages.test.ts` 按枚举断言动态键（zh / en / zh-TW）。
- 首页"今日天象"滚动到视口后显示月相、干支、节气，控制台无 error。星空画布未在 headless 下触发，`charts.planet` 仅由单测覆盖。

## 4. 提示条

- 修复：移动端条被固定底栏盖住按钮，`bottom` 改为底栏之上；压缩高度（375px 约 100px）；不再等账号查询才显示。
- 实测（桌面 + 375px，四个页面）：主操作不被遮挡，Tab 可达、Enter 可关闭，与 InstallPrompt 全程无重叠，控制台无 error。

## 检查结果

- 通过：`consent` / `client-messages` 单测、web typecheck、改动文件 eslint 与 prettier、`pnpm fonts:check`。
- `e2e/shell.spec.ts`：桌面 + 移动 16 项，整轮 15 项通过；桌面塔罗流程因 `/tarot/reading` 响应慢（最长 58 秒）超时，放宽等待后单独重跑通过。
- `birth-form.test.tsx` 的 "rectified birth provenance" 失败，用未改动的组件同样失败，非本次引入。
- 数字、奇门、八字：对话框出现且确认后原操作继续；本地无数据库，服务端返回错误，未走到报告页（错误来源为推断）。
- 未跑：全量 `pnpm test`、`cf:build`（含 `perf:budgets`）、需要数据库的 e2e。导航一键起盘未在浏览器验证。
