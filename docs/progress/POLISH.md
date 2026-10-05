# POLISH 上线前视觉与内容打磨

## 完成项
- 使用生产构建及隔离 PGlite PostgreSQL、Redis RESP、邮件与 Stripe 测试服务；命盘使用真实引擎。
- 新增 `pnpm test:polish`：375/1280px × zh/en 的页面、状态截图与交互验收。
- 覆盖首页、出生两步、A 七体系报告、每日、分享弹层/公开页、我的、设置、定价、牌/卦百科、登录。
- 加验空记录、加载、可恢复错误、城市无结果、无时辰报告与紫微缺时辰阻断。
- 修复后续账户/每日/分享样式的颜色、间距、圆角与动效 token；补齐链接、术语、表单触控尺寸。
- 修复章节导航收缩造成文字重叠；置信度进度条改为主题金色。
- 四柱改为 token 驱动的 CSS 入场与 150ms 减弱动效，避免离屏动画截图时四柱透明。
- 中文移动端同屏展示四柱，保留文楷 48px；英文长名称保留盘内横滑。
- 扩大星盘/吠陀 SVG 触控区，保持不可见；重叠区按最近符号选择，不遮盖盘面图形。
- 吠陀大运轴保留时长比例与日期指针；截断区间保底 44px，避免两个月尾段放大成 3 万像素空轴。
- 术语弹层增加可访问名称、zh/en 语言标记与清晰底色；公开分享补齐字体、星空、体系主题及全局偏好锁。
- 修复英文字体 token 在所有后代重新赋值的问题，西方/吠陀标题正确继承 Cinzel。
- 分享 PNG 补齐二维码、静态星点、规范配色与嵌入 Cinzel/Cormorant；显式公开一级后展示四柱缩略。
- 补齐紫微、塔罗、SVG 证据路径及高亮/焦点联动；兼顾系统与账户的减少动效偏好。
- 修复账户减少动效仍保留翻牌/摇卦/起局旋转的问题；两种偏好统一为淡入/直接显示。
- 修复异步账户设置回填覆盖正在编辑的主题/动效等偏好，并增加竞态回归测试。
- 已登录账户顶部切换为「我的」头像入口；无显示名时用登录状态文案，避免显示“匿名访客”。
- A/B/D/E 七体系共 54 份 zh/en 报告通过内容审计；E 紫微按规范拒绝，另验 8 份六爻，共 62 份。
- 每章非空且有结论、字数达标、无模板占位/禁词/语言残留，全报告过渡词去重。
- 修复 You、Yin/Wu 及 approach/progress 等普通词误标；保留显式术语计数，补齐 Yin/Yang Dun。
- 本命类最低 zh 6258 字/en 3518 词；占卜类最低 zh 3898 字/en 2081 词。
- 补齐神煞、紫微格局、六爻依据值的双语显示；修正 Yod 中文 KU 并补 3 条双语术语。
- knowledgeVersion 1.4.2、interpretVersion 1.1.2；content:validate 验证 3451 KU、615 术语。
- 走查塔罗洗/切/抽/翻牌、六次摇卦、梅花报数、奇门、紫微三方四正、占星点击/宫位制。
- 走查每日日期手势、主题持久化、语言切换保留路径、分享 PNG 下载、删除账户后会话/分享撤销。

## 截图与审计证据
- `test-results/polish/{375,1280}/{zh,en}/*.png`：212 张截图（每组 53）；180 份 JSON 记录主题/字体/溢出/触控。
- `test-results/polish/{375,1280}/{zh,en}/share-download.png`：实际下载的分享 PNG。
- `test-results/polish/reference/prototype-{375,1280}.png`：HTML 原型对照。
- `test-results/polish/reference/share-{zh,en}-{story,landscape}.png`：1080×1920/1200×630 图片渲染验证。
- `test-results/polish/review/`：逐页抽样拼图与七盘首段核对；`reports/`：62 份报告 JSON。
- `test-results/polish/content-audit.json`：章节、字数、语言、禁词与重复过渡检查。
- `test-results/polish/manifest.json`：四组截图尺寸、更新时间与路径；全部无溢出、小触控及导航重叠。
- `test-results/polish/lighthouse{.json,/}`：3 页 × 3 次，Accessibility 均 100，Performance 最低 88。

## DESIGN-GAP
- 内联链接/术语共享 44px 触控最小尺寸；密集 SVG 使用 64-unit 隐形目标及最近符号选择。
- 中文单字四柱在手机同屏，英文长名称横滑；全局主题/动效锁同样应用于独立公开页。
- 大运完整区间按时长分配宽度，截断边界区间保底触控尺寸；公开 /s 快照沿用所属体系主题。
- 设置回填仅恢复请求期间未改动的键；过渡词唯一性覆盖整份报告和低置信度结论。
- 无显示名的登录账户复用既有登录状态文案，不新增或改名文案键。
- 占卜置信度不受出生时辰缺失影响；字体完成信号供视觉检查等待实际字形加载。
- 固定时钟、数字与 seed；UUID 按尺寸/语言隔离幂等键，不替换加密用随机字节。
- 假广告 ID 仅验证占位，拦截广告投放；runner trace 与截图目录分离，重跑保留证据。
- Satori 配色镜像规范 token；零级公开图只用公开评分，二维码不包含出生输入；新增 qrcode/@types 为 MIT。
- Node 25/jsdom 使用完整 Storage 替身；受限存储沿用系统动效；双语术语、专名、DELETE 不算语言残留。
- 账户结果复用于无照片头像；数据库退出等待回调；同名词需显式标记，英文卦名保留正式大小写。

## 如何验证
- 已实际执行 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`，全部通过；57 文件/1213 测试。
- `pnpm polish:content`、`pnpm test:polish`：62 报告、24 浏览器测试通过；i18n 与 950 包许可检查通过，无 GPL/AGPL。
- `pnpm exec tsx scripts/perf-run.ts`：既有 Lighthouse 可访问性 ≥90、性能 ≥85 断言全部通过。

## 未完成项
- iPhone 12 Safari/Pixel 6a 实机帧率及 VoiceOver 听读未执行，浏览器模拟不等同于实机验收。
