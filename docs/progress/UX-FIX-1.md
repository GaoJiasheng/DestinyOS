# UX-FIX-1 线上走查缺陷修复（未完成，硬截止前的 WIP）

状态：只完成了文案修复和提示条的第一步；因硬性截止时间，其余项未做、且几乎都未经运行验证。

## 1. /zh/today、/zh/tarot 首访停在"正在加载……" —— 未复现，根因未确认

- 只做了代码阅读：`components/daily/use-daily-report.ts` 的加载不读取免责声明状态，
  匿名用户走 `calculateDailyInWorker`（Web Worker）在客户端计算，`busy` 只在该流程结束时清除。
  所以从代码看正文不是被弹窗状态 gate 住的；更可能是 worker 加载/计算在线上卡住或抛错未被捕获。这是推断。
- 没有启动本地 dev，也没有用 Playwright 复现。塔罗页完全没看。
- 待办：全新浏览器上下文打开两页，看控制台和 worker 请求；确认 worker 失败路径是否会落到 error 状态。

## 2. 首访弹窗改为底部提示条 —— 只完成一半

- 已做：`components/disclaimer.tsx` 从 Radix 模态框改成 `<aside class="disclaimer-bar">`，
  `position: sticky; bottom: 0`，在文档流内，不遮罩、不抢焦点、不锁滚动；含要点、完整免责声明链接、"我知道了"。
  存储机制未变（localStorage `tianji-disclaimer-v1` + 账号 `disclaimerAcceptedAt`）。
- 未做：起盘/提交出生信息/抽牌时的就地确认。**在补上之前，新用户可以不做任何 18 岁/免责确认就抽牌或起卦**
  （塔罗、易经、奇门没有出生日期，原先唯一的确认就是这个弹窗）。按出生日期的服务端年龄限制
  （`E_AGE_RESTRICTED` → `age_gate` cookie → `/age-restricted`）没有改动，仍然生效。
- 建议：就地确认做完之前不要把提示条这次提交单独上线。
- `e2e/shell.spec.ts` 已按提示条改写断言，未运行。

## 3. 首页体系卡片文案 —— 已改，未运行验证

- 根因：`(marketing)/page.tsx` 把 numerology 归进"需要出生时间与地点"，synastry 借用了报错文案 `synastry.requiresTwo`。
- 改法：新增 `home.cards.numerology`、`home.cards.synastry`（zh/en，zh-TW 由脚本生成）。

## 4. home.sky.origin —— 已改，未运行验证

- zh：此刻的星空 · 未开启定位时按默认地点显示；en 同义。

## 5. charts.planet.sun MISSING_MESSAGE —— 未做

- 本分支基线上不存在 `apps/web/i18n/client-messages.ts`，布局用 `getMessages()` 下发全量消息。
  没有复现、没有补键、没有加测试。

## 未完成 / 未验证

- 实际跑过并通过：`tsx scripts/i18n-check.ts`（即 `pnpm i18n:check`）；改动文件的 prettier；
  `disclaimer.tsx`、`shell.spec.ts`、首页 `page.tsx` 的 eslint。
- zh-TW 由 `tsx scripts/i18n-traditional.ts` 生成；该脚本写完目录后因缺少内容构建产物
  （`apps/web/resources/learn.json`）报错退出，后半段（字体语料、glossary 版本）没有执行，合并后需重跑 `pnpm content:build`。
- 未跑：全量 `pnpm lint`、`pnpm typecheck`（web 的 tsc 超时未出结果）、`pnpm test`、任何 e2e、控制台 error 检查。
- 新增文案可能引入字体子集外的字形（`scripts/font-subsets.py` 覆盖 home./legal.），需跑 `pnpm fonts:check`。
- 提示条的移动端遮挡、键盘操作、与 InstallPrompt 的叠放都没有在浏览器里看过。
