# App 体验审查（2026-11-15，Expo / React Native）

范围：`apps/mobile`（iOS 为主；Android 原生构建尚未开放，Android 相关条目都标了「未实机」）。对照网页端同日审查 `docs/progress/UX-AUDIT-2026-11-15.md` 的问题类别逐项排查，再补 App 特有的问题。

方法：只读代码。没有跑模拟器、Metro、Maestro。城市搜索的结果和耗时是用 node 直接加载 `assets/cities/cities.bin`、套用 `lib/cities.ts` 的同一算法实测的；i18n 用脚本扫了全部 `t('…')` / `label('…')` 字面 key 和三份目录。其余每条都给了证据行；标「未实机」的是代码推断，需要上机确认。

优先级：P0 功能坏了；P1 会丢数据、算错盘或把用户锁在外面；P2 明显受挫；P3 打磨。

**结论**：没有发现 P0。P1 五条：表单默认值会排出错盘、给别人建档会把「今日」换成别人、未满 13 岁会被永久锁死、通知权限在没解释前就弹、每日记录淹没报告历史。i18n 很干净：`mobile.*` 三语齐全，组件里没有硬编码中文，动态 key 都有兜底。

网页端修复时新增的不少文案 key 可以直接复用（见文末「可复用的网页 key」）。

## 修复记录（2026-11-16，提交 `93bb4e4`）

44 条里绝大部分已修，全部没有上机验证（没跑模拟器和 Maestro）。下面只列没做完或需要上机确认的。

- **1.3**：未满 13 岁先确认再锁，锁定页文案改准确；已被锁的设备如何解锁没有做（owner 决策）。
- **2.4**：城市数据里没有「NYC」这类缩写，输入 nyc 仍搜不到纽约。
- **6.3**：匿名用户可以删除单份报告、清空本机数据；历史行左滑删除和导出 JSON 没做。
- **P3 运行时字体加载**：没做，要先上机确认原生内嵌字体名。
- **报告切换语言后**，段落里的术语名仍按全局语言显示（`report-paragraph.tsx` 未改）。
- **Maestro 流程**：出生表单现在必须选月、日、时辰，`M05`、`M05-en`、`M05-age`、`M11`、`ios-build/IOS-BUILD-onboarding` 的滚轮步骤要上机补；`M10` 退出确认按钮的定位要上机核对。
- **需要上机确认**：日历跳转（`router.dismissTo`）带日期参数、日记多行输入、Android 键盘避让、首次启动按系统语言选择。
- **测试环境**：`test/setup.ts` 加了基于 Node crypto 的 expo-crypto mock；此前凡是加载到本机存储的套件在这台机器上都跑不起来。

---

## P1 会算错、丢数据或锁住用户

### 1.1 出生表单默认 1 月 1 日、早子时，不碰就能提交（同网页 1.5 / 2.1）
- **现象**：年份必须填，但月和日默认是 1 月 1 日，时辰滚轮默认停在「早子」(hour 0)。用户只填年份、滑过时辰滚轮也不会注意，「下一步」→「保存」后八字时柱是子时，日柱是 1 月 1 日。整份报告错了，用户却不知道。
- **证据**：`components/birth-form.tsx:33-44`（`month: 1, day: 1, hour: 0, minute: 0`）；`components/birth-date-fields.tsx:165-175`（时辰滚轮从 `birth.hour ?? 0` 取值）；`birth-form.tsx:129-147`，第 1 步只做 `validateBirth`，不检查用户有没有选过。
- **建议**：`BirthInput` 外再存一份表单态 `{ month?: number; day?: number; hour?: number }`。月、日、时辰滚轮的第一项是占位「请选择」（value `-1`）。第 1 步提交时，未选的项各报一条错误，除非勾了「我不知道出生时间」；时辰缺失时报 `form.birth.error.hourRequired`。编辑已有档案时照常预填。验收：新建档案只填年份就点「下一步」，会被拦下并报出缺哪几项。

### 1.2 给伴侣、家人建档后，「今日」「日历」「推算」「通知」「小组件」全变成那个人（同网页 1.2）
- **现象**：每次保存档案，不管「关系」选的是不是「自己」，都会把它设为当前档案。之后「今日」运势、日历、推算 Tab 的一键报告、每日推送、小组件都换成刚建的人。「今日」页不显示当前是谁，用户察觉不到。合盘页的「添加档案」也会走这一路。
- **证据**：`lib/profiles.tsx:127-142`（`save` 总是写 `activeProfileId: record.id`）；`components/birth-form.tsx:148-160`；`components/daily/today-screen.tsx:82`（标题只有「今日」，没有档案名）；`components/engagement-bootstrap.tsx:47`（推送和小组件用 `active`）；`components/synastry-screen.tsx:69-74`。
- **建议**：`save(profile, id, { activate })` 只在两种情况下切换当前档案：新建的是第一份档案，或者 `relation === 'self'` 且用户确认「这是我」。复用网页的 `form.birth.for.*`：第 1 步顶部放「为谁排盘：我自己（更新本机档案）/ 别人（不改动我的档案）」，默认值跟着 `relation` 走。「今日」标题下加一行「{name} 的今日」，点它跳到「我」切换档案。

### 1.3 输入未满 13 岁的生日，立即永久锁死，App 内没有出口（同网页 1.1，App 更严重）
- **现象**：第 1 步点「下一步」时，算出不满 13 岁就写入 `ageBlocked: true`，并跳到 `/age-restricted`。这个状态存在加密库里，重启后仍然有效。会话守卫把所有路由都重定向过去，包括设置和登录，App 里没有任何解除或清除数据的入口，只能卸载重装（SQLCipher 密钥在钥匙串里，重装后能否恢复也未验证）。给孩子建「家人」档案、年份手滑都会触发。锁定页的标题写「本服务面向 18 岁以上用户」，正文写「本次会话不能重新提交」，阈值和时效都和实际行为不符。
- **证据**：`components/birth-form.tsx:139-142`；`components/session-gate.tsx:48-49`；`app/age-restricted.tsx:6-10`；文案 `form.birth.age.title` 和 `form.birth.age.body`。数据层也会拒存：`lib/data/repository.ts:73-84`（`E_AGE_RESTRICTED`）。
- **建议**：按网页做法，锁之前先弹 `Alert`，复用 `form.birth.ageCheck.*` 的文案和按钮。选「是别人的 / 我填错了」时不锁，在字段旁显示 `form.birth.error.underThirteen`。锁定页加「清除本机数据并重新开始」，调用 `eraseDeviceData()` 后 `reload()`。文案的阈值统一为 13 岁，「本次会话」改成实际的作用范围。是否放宽合规口径由 owner 决定。

### 1.4 引导第 2 屏自动弹系统通知权限，用户还没看到说明
- **现象**：引导第 2 屏（产品介绍）一出现就调用 `requestNotificationPermission`，iOS 系统弹窗立即出现。解释「每天 8:00 提醒」的那一屏在第 4 屏。iOS 只给一次机会，用户在没有上下文时容易点「不允许」，之后只能去系统设置里打开。
- **证据**：`components/onboarding.tsx:27-38`（`step === 1` 时自动请求）；第 4 屏的说明与按钮在 `onboarding.tsx:101-133`。
- **建议**：删掉 `useEffect` 里的自动请求，只在第 4 屏用户点「开启提醒」时请求，并保留「跳过」。更好的做法是推迟到第一次看完今日运势后再问。

### 1.5 每日运势记录淹没「报告历史」，列表可能一片空白，旧报告会被挤掉
- **现象**：每打开一次「今日」或切换一次日期，都会把一份中英双语的每日报告写进 `Reading` 表。历史页只取最新 500 条，再过滤掉不能渲染的 `daily`：
  1. 只用过「今日」的用户进历史页，列表是空的，但「还没有报告」的空态也不显示，因为 `readings.length` 包含 daily；
  2. 每天至少写一条，用一年多以后，真正的报告会被挤出前 500 条，从历史里消失；
  3. 这些记录没有任何淘汰机制，加密库只增不减。
- **证据**：`lib/daily/service.ts:74-103`（每次 `loadDaily` 都 `readings.save`）；`components/history-screen.tsx:24-35`（`list(500)` 后只按档案过滤）、`:58`（空态判断）、`:69-85`（daily 渲染成 `null`）。
- **建议**：历史查询在 SQL 层排除 `system='daily'`。`Repository` 加一个 `listBySystem(systems, limit, offset)`，或者用 `json_extract(data,'$.system')`。查询做成分页的 `onEndReached`。每日记录只保留最近 N 天（建议 90 天，日记引用的日期除外），在启动或 `loadDaily` 里清理。验收：造 600 条 daily 加 3 条八字，历史页仍然列出这 3 条八字。

---

## P2 明显受挫

### 2. 出生表单与档案

| # | 现象 | 证据 | 建议 |
|---|---|---|---|
| 2.1 | 错误笼统，出现得太早：年份打第一个数字就显示红字「输入信息无效，请检查日期、时间和时区」（年份不满 4 位时按 0 处理）；错误只显示在页面底部按钮上方 | `birth-form.tsx:91`（`touched` 即校验）、`:303`；`birth-date-fields.tsx:53-56`；`lib/birth-form.ts:26-37` | 失焦或提交时再校验；按字段给具体原因，复用 `form.birth.error.*`（`yearRequired`、`noSuchDay` 等），显示在对应字段下方，提交失败时滚动并聚焦到第一个错误 |
| 2.2 | 第 2 步用 iOS 侧滑或 Android 返回键会直接离开表单，两步的输入全丢；保存后一律 `replace('/me')`，从今日、推算、合盘、引导进来的都回不到原处（同网页 2.6 / 4.9） | `birth-form.tsx:160`、`:310-318`；没有 `usePreventRemove` | 表单有改动时用 `usePreventRemove` 弹确认（参照 `lib/rituals/session.ts:59`）；第 2 步拦截返回动作，改为回到第 1 步；支持 `returnTo` 参数（今日、推算、合盘、引导传入），保存后 `router.replace(returnTo ?? '/me')`；推算页传 `system`，保存后直接出那个体系的报告 |
| 2.3 | 匿名最多 3 份档案，但第 4 份要两步都填完点保存才报 `E_PROFILE_LIMIT`，填的内容白费 | `lib/profiles.tsx:116-117`；`birth-form.tsx:162-165`；入口 `profile-screen.tsx:49-53` | 「添加档案」在 `profiles.length >= 3 && !session` 时禁用，并说明「最多 3 份，登录后可增加」；表单打开时也检查一次 |
| 2.4 | 城市搜索：(a) 打了字没点候选，地点其实没变，界面没有提示；(b) 选中的城市不能清除；(c) 候选和选中值都只显示英文名，中文界面显示「Beijing · CN · Beijing · Asia/Shanghai」；(d) 别名不做简繁互通，「温哥华」没有结果（只有「溫哥華」）；(e) 没有精确匹配加权（输入「nyc」排第一的是 Bortnychi）；(f) 每次按键都对 7.8 万城市重新做全部别名的 normalize，不防抖，node 上单次 17–21 ms，Hermes 上会更慢（未实机） | `birth-form.tsx:200-236`；`lib/cities.ts:41-55`；node 实测 | 选中后 `query` 显示城市名并加清除按钮（`form.birth.city.clear`）；有未选中的输入时提示 `form.birth.city.unselected`；候选按 locale 显示中文别名；加载时预计算 normalize 后的别名，并把简繁字形各加一份；排序加「精确 > 前缀 > 包含」；输入防抖 150 ms |
| 2.5 | 手动经纬度的时区预填为 `UTC`（英文界面）或 `Asia/Shanghai`（中文），而且要手打 IANA 名。英文用户填纽约坐标、没改时区，盘会差 5 小时 | `birth-form.tsx:54-58`、`:247-260` | 时区默认取设备时区 `Intl.DateTimeFormat().resolvedOptions().timeZone`；改为可搜索的时区列表（与 3.6 奇门共用组件） |
| 2.6 | 「我」页点一下档案就切换为当前档案（立刻影响今日、通知、小组件）；编辑和删除只作用于当前档案，想删别人的档案得先把它设为当前 | `components/profile-screen.tsx:34-83` | 每行显示「设为当前 / 编辑 / 删除」，或者点进档案详情页；切换当前档案时提示「今日运势将改为 {name}」 |

### 3. 推算 Tab、报告、追问

| # | 现象 | 证据 | 建议 |
|---|---|---|---|
| 3.1 | 推算 Tab 点八字、紫微、占星、吠陀、灵数会立刻用当前档案出报告，没有「用谁」的选择；每点一次多一份重复报告；没有档案时跳去建档，建完回到「我」，用户还得再点一次（同网页 3.5） | `app/(tabs)/reading.tsx:17-33`、`:44-56` | 顶部显示「当前：{name}」，并可切换档案；同一档案、同一版本、同一体系已有报告时直接打开旧报告（查最新一条）；无档案时 `push('/me/birth?returnTo=/reading&system=…')`（依赖 2.2） |
| 3.2 | 出报告在 JS 线程同步计算（`compute` 加两次 `interpret`），中间没有让出一帧：`setBusy(true)` 之后的「生成中」文案来不及显示，界面会卡住一阵（时长未实机测）；今日页反而用了 `setTimeout(32)` 让出 | `reading.tsx:23-26`；`lib/reports/readings.ts:110-120`；对照 `lib/daily/use-daily.ts:24` | 在 `createNativeReading` 前 `await new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)))`；合盘页同样处理（`synastry-screen.tsx:28`） |
| 3.3 | 灵数从不传姓名，只有生日数字，没有表达数、灵魂数（网页有姓名输入） | `readings.ts:88-109`，构造 `ComputeInput` 时没有 `name`；引擎读 `input.name`（`packages/engine/src/index.ts:343-351`） | 点灵数时弹出可选的「罗马拼音姓名」输入（复用网页 `numerology-form` 的文案），作为 `name` 传给 `compute` 和 `ReadingRequestSchema` |
| 3.4 | 报告页左上角按钮写「再算一个体系」，点了一律 `replace('/reading')`：从历史打开的报告回不到历史，从塔罗结果点也回到推算 Tab | `components/report/report-screen.tsx:126`、`:146-150` | 有历史栈时 `router.back()`，文案用「返回」；另外放一个「再算一个体系」次级按钮 |
| 3.5 | 报告页的语言切换只有「中文 / English」，繁体用户点「中文」会把整个 App 改成简体，而且两个按钮都不显示选中 | `report-screen.tsx:177-185` | 三语都列出，或者直接去掉（全局语言在设置里改）；保留的话 `selected` 用 `sourceLocale(locale)` 判断 |
| 3.6 | 塔罗、周易、奇门报告也显示五维雷达、五个星级、「置信度 100%」和「命盘」折叠钮；评分没有区分度时雷达是正五边形（网页 5.4 已修，App 用同一个 interpret 包，数据相同） | `components/report/report-headline.tsx:37-85`；`report-screen.tsx:206-220` | `ReportHeadline` 在 `system ∈ {tarot, iching, qimen}` 或五项分数全部相同时不画雷达和星级；占卜体系隐藏置信度；「命盘」按钮按体系改名（牌阵 / 卦象 / 局） |
| 3.7 | 追问：Android 上 `KeyboardAvoidingView` 的 `behavior` 是 `undefined`，SDK 57 的 edge-to-edge 下底部输入框可能被键盘盖住（未实机）；输入框是单行，回车只收起键盘不发送；点「取消」会把已生成的半段回答直接清掉 | `components/native-ui.tsx:77-80`；`chat-screen.tsx:146-152`、`:163-171` | Android 用 `behavior="height"`，或换 `react-native-keyboard-controller`；`Field` 支持 `multiline` 和 `onSubmit`，聊天里 `returnKeyType="send"`；取消时把已生成的内容留在界面上并标注「已停止」 |

### 4. 今日与日历

| # | 现象 | 证据 | 建议 |
|---|---|---|---|
| 4.1 | 日期切换：按钮始终叫「昨天 / 今天 / 明天」（从日历点进 11 月 3 日后，「明天」其实是 11 月 4 日）；大标题始终是「今日」；当前是哪天没有高亮；只能往后看到明天，但从日历可以打开当月任意一天（同网页 4.1 / 4.2） | `today-screen.tsx:38-45`、`:82`、`:98-112`；`calendar-screen.tsx:160` | 改用 `daily.previousDay` / `daily.nextDay`；不是今天时标题显示日期，并加「回到今天」；三个按钮做成分段控件，高亮当前项；后翻的上限与日历一致 |
| 4.2 | 日记写到一半，下拉刷新或左右滑动切换日期，输入全丢：`useDaily` 一开始重算就 `setValue(null)`，`JournalEditor` 随之卸载。日记框是单行输入，却允许写 500 字 | `lib/daily/use-daily.ts:18-22`；`today-screen.tsx:309-323`；`journal-editor.tsx:122-131` | 重算期间保留旧的 `value`，只叠一层加载态；切换日期前有未保存的日记时弹确认；日记框用 `multiline`，`minHeight` 约 120 |
| 4.3 | 日历分数是原始小数：大字号模式下格子里显示「…总评 63.3 分」，读屏也会读出小数（同网页 4.5） | `calendar-screen.tsx:151-154`、`:180-185` | `Math.round(day.overall)`，或者只播报星级（`dailyStars`） |
| 4.4 | 「年度重要日期」从 1 月 1 日开始列，11 月打开要滚过一整年的过去日期（同网页 4.6） | `calendar-screen.tsx:207-220` | 默认从今天往后列，过去的日期折叠成「已过去 N 个」 |

### 5. 塔罗、周易、奇门与「问」

| # | 现象 | 证据 | 建议 |
|---|---|---|---|
| 5.1 | 塔罗点「开始」后回不去改问题和牌阵；选牌不能撤销（同网页 6.5 / 6.6） | `components/rituals/tarot-ritual.tsx:84-91`、`:136-175` | 洗牌、切牌、选牌各阶段加「上一步」；选牌阶段点已选牌位可以取消；抽牌后回到设置时要确认会重新洗牌 |
| 5.2 | 周易点「继续」后回不去改问题、换起卦方式（同网页 6.6） | `iching-ritual.tsx:186-205`、`:144` | 起卦前加「返回修改问题」（`divination.backToQuestion`，网页已有） |
| 5.3 | 奇门的「起局时刻」是可编辑的原始 ISO 文本（形如 `2026-11-15T21:37:12.123`），时区要手打 IANA 名；打开日期选择器的按钮复用了「日期与时间」，旁边的时间按钮写的是「出生时间」 | `qimen-ritual.tsx:83-107` | 起局时刻改成只读展示加两个选择器按钮；时区做成可搜索列表（与 2.5 共用）；按钮文案改为「选择日期 / 选择时间」 |
| 5.4 | 「问」弹窗只有 4 个按钮，没有问题输入框，选完进入塔罗或周易还得再填一遍问题；「追问大师」跳到报告历史，没有报告时是空列表，有报告也要自己找到追问入口（同网页 3.3 / 3.4） | `components/ask-sheet.tsx:48-88` | 加一个问题输入框，作为 `question` 参数带进 `/tarot/reading` 和 `/iching`，两个仪式页读取后预填；「追问大师」改为打开最近一份报告的 `/r/[id]/chat`，没有报告时提示先排一份 |

### 6. 账户、设置、存储、壳层

| # | 现象 | 证据 | 建议 |
|---|---|---|---|
| 6.1 | 登录后不回原处：从报告的导出、分享或追问点「登录」，登录后的按钮写「返回首页」，实际 `replace('/me/settings')`（同网页 3.11） | `account-screen.tsx:53-58`；`report-actions.tsx:126-131`；`chat-screen.tsx:187-189`；文案 `auth.login.continue` | `/auth/login?returnTo=…`，只接受应用内路径；登录完成或做完导入决定后 `replace(returnTo)` |
| 6.2 | 离线时退出登录会失败：先调远端注销，抛错后 `clear()` 不会执行，只显示网络错误 | `lib/account/controller.ts` 的 `logoutAccount`（先 `request(mobileLogoutEndpoint)`，后 `clear()`） | 先本地 `clear()`，远端注销放进重试队列，或者 `catch` 后继续；退出前弹确认，说明本机账户数据的去向 |
| 6.3 | 匿名用户没有任何本机数据管理：不能删除单份报告，不能「清除本机全部数据」，不能导出或导入（`eraseDeviceData` 已实现但没有入口）；同网页 7.6 | `lib/data/store.ts:78-80`（全仓无调用）；`components/account-screen.tsx:148-243`（未登录只有登录按钮） | 设置页加「本机数据」分区：报告数、档案数，「清除本机全部数据」（二次确认，调用 `eraseDeviceData` 再 `reload`），历史行支持左滑删除；导出 JSON 可以后做 |
| 6.4 | 通知设置：(a) iOS 时间滚轮每滚过一格就 `save` 一次，并重排 7 天提醒；保存期间 `disabled={busy}`，滚轮会被禁用（未实机）；(b) Android 上 `<DateTimePicker>` 常驻挂载，会在页面打开时直接弹出系统时间对话框（未实机）；(c) 系统拒绝通知权限后仍然保存为「开启」，开关显示开着 | `components/notification-settings.tsx:29-34`、`:66-80` | 时间改为点按钮后弹出选择器，确认后再保存；Android 按需挂载；权限被拒时 `dailyPushEnabled` 保存为 `false`，并显示去系统设置的入口 |
| 6.5 | 没有任何 `ErrorBoundary`：渲染时抛错会整屏崩掉，例如报告页在渲染里直接调用 `normalizeBirth`，旧数据的时区不再有效时就会抛；另外加密库里任何一行档案过不了 zod，`profiles.list` 就整体失败，整个 App 停在「本地数据暂时无法读取」，重试也没用 | `app/_layout.tsx`（全仓 grep `ErrorBoundary` 无结果）；`report-screen.tsx:104`；`lib/data/repository.ts:166-178`（`decode` 用 `parse`）；`lib/profiles.tsx:51` | 根布局和 `[system]/r/[id]` 导出 expo-router 的 `ErrorBoundary`（重试加回首页）；`report-screen.tsx:104` 包 try；`Repository.list` 用 `safeParse`，坏行跳过并上报 Sentry（不带内容） |
| 6.6 | 首次启动语言固定为简体中文，不看系统语言；英语用户看到的第一屏是中文，好在同屏有语言选择 | `lib/preferences.ts:17`；全仓没有 `expo-localization` | 加 `expo-localization`，首次启动时按 `getLocales()` 映射：`zh-Hant`/`zh-TW`/`zh-HK` 用繁体，`zh*` 用简体，其余用英文 |

---

## P3 打磨项

- **文案错位**：删除档案确认框的取消按钮用了 `mobile.ask.close`，显示「收起」（`profile-screen.tsx:75`）；通知设置的「重新生成」按钮用了 `mobile.profiles.retry`，显示「重试」（`notification-settings.tsx:115-120`）；登录后的「返回首页」实际去设置页（`account-screen.tsx:56-57`）；每日分享失败提示「本地数据无法读取」（`daily-share.tsx:107`）；塔罗洗牌说明写「点击」，是网页文案（`tarot.shuffleHelp`）。
- **键盘类型**：年份、周易数字、经纬度用的是 `numbers-and-punctuation`，iOS 弹出带标点的键盘，Android 不认这个值。年份和数字应该用 `number-pad`，经纬度用 `numbers-and-punctuation`（`native-ui.tsx:195`）。邮箱框没有设 `keyboardType="email-address"`、`textContentType="emailAddress"`、`autoComplete="email"`（`account-screen.tsx:88-94`）。魔法链接没有重发冷却，改了邮箱「已发送」提示也还在（`account-screen.tsx:95-108`）。
- **无障碍**：雷达图的 `accessibilityLabel` 只有「五维评分（1 至 5 星）」，没有各项数值；星级是 `'★'.repeat(n)`，读屏会逐个读符号（`report-headline.tsx:37`、`:65`）。改成每项一句「事业 3 星」作为 label。
- **历史行**：只显示「体系 · 日期」，日期取的是 `createdAt` 的 UTC 日期，北京时间凌晨的报告会显示成前一天；塔罗、周易看不出问的是什么（`history-screen.tsx:74-77`）。改用本地日期，加档案名或问题摘要。
- **今日页**：点一下「今日一句」卡片就弹出分享面板，容易误触，分享改为只响应长按或专门的按钮（`today-screen.tsx:174-179`）。
- **紫微缺时辰**：档案勾了「不知道出生时间」时，推算 Tab 的紫微按钮照样可以点，点完在页面顶部显示一行「此体系需要准确的出生时间」，没有去修改的入口（`reading.tsx:38`）。按钮应该直接标注需要时辰，并给「补填时辰」入口。
- **深链**：首次启动尚未完成引导时，通知或深链进来会被会话守卫重定向到 `/`，原目标丢失（`session-gate.tsx:52-53`）。可以在引导结束后按保存的原目标跳转。
- **日历 → 今日**：`router.push('/today', …)` 从日历栈页推回 Tabs，可能叠出第二个 Tabs 实例，Android 返回键会回到日历（未实机，`calendar-screen.tsx:160`）。可以改用 `navigate` 或 `dismissTo`。
- **Tab 栏高度**：Tab 栏写死 `height: 60 + 24 * fontScale`，覆盖了 React Navigation 按底部安全区自动加的高度，带 Home 指示条的机型内容区会被压扁（未实机，`app/(tabs)/_layout.tsx:34-38`）。高度应加上 `insets.bottom`，或者只设 `minHeight`。
- **启动**：`useFonts` 在首屏前加载 wenkai 和 noto 两个约 1.2 MB 的中文字体，而 `app.config.ts:193-204` 已经用 expo-font 插件把它们原生内嵌了，可能是重复加载、拖慢首屏（未实机，`app/_layout.tsx:25-29`）。确认原生字体名能直接用后，去掉运行时加载。
- **网络探测**：前台每 15 秒请求一次 `/api/v1/health`，只要 App 在前台就一直发（`connectivity-bootstrap.tsx:36`）。可以改成指数退避，连通后放慢到 60 秒以上。
- **重复入口**：「我」页和设置页都放了主题和语言选择，主题选项「自动 / 东方 / 西方 / 吠陀」没有说明（同网页 3.8，`profile-screen.tsx:104`、`account-screen.tsx:241`）。

## 做得好的地方（不用再查）

- **i18n**：脚本扫描全部字面 key，三语目录都有；`mobile.*` 繁体不是简体照抄；组件里没有硬编码中文；动态 key 缺失时 `useChartLabel` 会兜底，不会露出 key 名。
- **仪式**：起卦和塔罗用 `usePreventRemove` 做了离开确认（包括侧滑和返回键），切到后台会取消动画定时器；音效是真实素材，不是占位；触感反馈可以关；减弱动效同时认系统设置和 App 内开关，导航转场也生效。
- **离线**：报告、今日、日历、百科、仪式都在本机计算，离线可用；需要联网的按钮离线时禁用并说明原因。
- **存储与账户**：数据全部存在 SQLCipher 里，按账户分开；登录后匿名数据要用户明确同意才导入；聊天「删除全部对话」有确认；删除账户要输入 DELETE。
- **无障碍基础**：按钮最小 48pt 并有 `accessibilityLabel`，单选有 checked 状态，标题有 header 角色并在换页时聚焦；字体跟随系统字号；日历在大字号下改成整行显示。
- **加载与错误**：今日、日历、历史、报告、日记都有加载、错误和重试，报告缺失时有「再算一个体系」的出口。

## 可复用的网页 key（已在 `apps/web/messages`）

`form.birth.for.{legend,self,other}`、`form.birth.ageCheck.{title,body,self,other}`、`form.birth.error.{yearRequired,monthRequired,dayRequired,noSuchDay,notLeap,lunarDays,hourRequired,timeRequired,tz,underThirteen}`、`form.birth.hourPlaceholder`、`form.birth.city.{unselected,clear,clearLabel}`、`daily.previousDay`、`daily.nextDay`、`report.folds.expandAll`、`divination.backToQuestion`。

---

## 建议施工拆分（文件范围互不重叠）

文案目录 `apps/web/messages/{zh,en}.json` 是共用文件（繁体由 `pnpm i18n:traditional` 生成）。新 key 建议各包统一加 `mobile.<包名>.` 前缀，最后由一人合并、跑 `pnpm content:build`，或者各包依次提交。

**包 A：出生表单与档案**（1.1、1.2、1.3、2.1–2.6、P3 深链）
`components/birth-form.tsx`、`components/birth-date-fields.tsx`、`components/birth-school-fields.tsx`、`lib/birth-form.ts`、`lib/cities.ts`、`lib/profiles.tsx`、`components/profile-screen.tsx`、`app/age-restricted.tsx`、`components/session-gate.tsx`、`app/me/birth.tsx`
对外接口：`/me/birth` 支持 `returnTo`、`system`、`relation` 参数，供包 C 使用；导出一个时区选择组件 `components/timezone-picker.tsx`（新建），供包 D 使用。

**包 B：今日、日历、日记、历史**（1.5、4.1–4.4、P3 今日卡片 / 历史行 / 日历跳转）
`components/daily/*`、`lib/daily/*`、`components/history-screen.tsx`、`lib/data/repository.ts`（新增按体系查询和清理旧 daily）、`app/today/calendar.tsx`

**包 C：推算入口与报告**（3.1–3.6、P3 雷达无障碍 / 紫微）
`app/(tabs)/reading.tsx`、`lib/reports/readings.ts`、`components/synastry-screen.tsx`、`components/report/report-screen.tsx`、`components/report/report-headline.tsx`、`components/report/report-section.tsx`、`app/[system]/r/[id].tsx`
依赖包 A 的 `returnTo`；可以先按约定的参数名写，A 合入后联调。

**包 D：仪式与「问」**（5.1–5.4）
`components/rituals/*`、`lib/rituals/*`、`components/ask-sheet.tsx`、`app/(tabs)/ask.tsx`、`app/tarot/reading.tsx`、`app/iching.tsx`、`app/qimen.tsx`
奇门时区选择用包 A 的组件；A 未合入前先保留文本框。

**包 E：壳层、账户、设置、通知**（1.4、3.7、6.1–6.6、P3 文案 / 键盘 / Tab 栏 / 字体 / 网络探测）
`app/_layout.tsx`、`app/(tabs)/_layout.tsx`、`components/onboarding.tsx`、`components/native-ui.tsx`、`components/preferences.tsx`、`lib/preferences.ts`、`components/account-screen.tsx`、`lib/account/controller.ts`、`components/notification-settings.tsx`、`components/connectivity-bootstrap.tsx`、`components/report/chat-screen.tsx`、`components/report/report-actions.tsx`、`lib/data/store.ts`（只加入口，不改结构）
注意：`native-ui.tsx` 的 `Field` 加 `multiline`、`keyboardType`、`onSubmit` 等属性要保持向后兼容；包 A、B 需要的键盘类型等 E 合入后再接。
