# 03 · 视觉与动效规范

> 目标："花哨但不廉价"。全站暗色星空基调；东方体系（八字、紫微、周易、奇门）用「朱砂 × 鎏金 × 墨」局部主题，西方体系（塔罗、占星、生命灵数）用「靛紫 × 月白 × 古金」局部主题，吠陀用西方主题的暖色变体（藏红 × 古金）。所有颜色、字号、间距、动效时长都是 token，前端只能用 token。

## 1. 设计 Token（Tailwind 4 `@theme` + CSS 变量）

### 1.1 基础色（全站）

| token | 值 | 用途 |
|---|---|---|
| `--bg-0` | `#05070F` | 页面最底色（近黑的深蓝） |
| `--bg-1` | `#0A0E1C` | 区块底 |
| `--surface-1` | `#111628` | 卡片 |
| `--surface-2` | `#181F36` | 浮层、悬停卡 |
| `--surface-glass` | `rgba(24, 31, 54, 0.55)` + `backdrop-filter: blur(16px)` | 玻璃卡（命盘悬浮信息） |
| `--line-1` | `rgba(255,255,255,0.08)` | 分割线 |
| `--line-2` | `rgba(255,255,255,0.16)` | 强分割/边框 |
| `--text-1` | `#F3F1EA`（暖白） | 标题、正文 |
| `--text-2` | `#B8B5AC` | 次要文字 |
| `--text-3` | `#7D7B74` | 占位、脚注 |
| `--gold` | `#D4AF6A` | 全站强调（品牌金） |
| `--gold-soft` | `#E8D3A3` | 金色文字 |
| `--success` | `#5FB88A` | |
| `--warning` | `#E0A94B` | |
| `--danger` | `#D9534F` | |
| `--info` | `#6C9BE0` | |

对比度：`--text-1` on `--surface-1` ≈ 14:1；`--text-2` on `--surface-1` ≈ 7.5:1；`--gold-soft` on `--bg-0` ≈ 10:1。所有 ≥ 4.5:1。

### 1.2 东方主题（`data-theme="east"`）

| token | 值 | 用途 |
|---|---|---|
| `--accent` | `#C8412B`（朱砂） | 主按钮、高亮 |
| `--accent-2` | `#D4AF6A`（鎏金） | 次强调、边框 |
| `--accent-glow` | `rgba(200,65,43,0.35)` | 发光 |
| `--ink` | `#1B1D2A` | 印章/墨块底 |
| 五行：木 `--wu-wood #3FA66B`、火 `--wu-fire #D9483B`、土 `--wu-earth #C8963E`、金 `--wu-metal #D8D4C8`、水 `--wu-water #3C7DD9` | | 五行着色（文字版同时标注名称） |
| 四化：禄 `#5FB88A`、权 `#9B6BD9`、科 `#6C9BE0`、忌 `#D9534F` | | 紫微 |
| 纹理 | `east-paper.png`（宣纸噪点，opacity 0.06）叠在 surface 上 | |
| 装饰 | 回纹/云纹 SVG 线框（stroke `--line-2`），印章式标签（圆角 2px、朱砂底、白字、篆体感字重） | |

### 1.3 西方主题（`data-theme="west"`）

| token | 值 | 用途 |
|---|---|---|
| `--accent` | `#6B5BD2`（靛紫） | |
| `--accent-2` | `#C9A961`（古金） | |
| `--accent-glow` | `rgba(107,91,210,0.35)` | |
| 四元素：火 `#E06A4F`、土 `#8FA66B`、风 `#E8D86A`、水 `#5A8FD9` | | 占星/塔罗元素 |
| 相位：合 `#C9A961`、三分/六分 `#5A8FD9`、四分/冲 `#E06A4F`、次相位 `--line-2` | | |
| 纹理 | `west-vellum.png`（羊皮纸噪点，opacity 0.05） | |
| 装饰 | 细线几何（圆、三角、黄道符号），铜版画风格 SVG 分隔线 | |

### 1.4 吠陀变体（`data-theme="vedic"`，继承 west 并覆盖）
`--accent #D9822B`（藏红）、`--accent-2 #C9A961`、纹理为曼陀罗细线（opacity 0.05）。

### 1.5 主题切换规则
- 路由决定：`/bazi|ziwei|iching|qimen` → east；`/tarot|astrology|numerology` → west；`/vedic` → vedic；`/`、`/today`、`/me`、`/learn` → `neutral`（仅基础色 + 金）。
- 用户可在设置锁定一个主题（`User.theme`），锁定后全站不随路由变。
- 切换时 `color` / `background` 过渡 400ms。

### 1.6 字体

| 角色 | zh | en | 加载 |
|---|---|---|---|
| 东方标题 | **LXGW WenKai**（霞鹜文楷）—— 用于大字干支、卦名、宫名 | Cormorant Garamond 600 | 子集化：干支、六十四卦、星曜、常用 3500 字 |
| 西方标题 | Noto Serif SC 600 | **Cinzel** 600（仅标题，字母间距 0.04em） | |
| 正文 | Noto Serif SC 400（阅读舒适、符合"研读"调性） | Inter 400/500（或系统字体栈） | `font-display: swap` |
| 数字/数据 | Inter Tabular（`font-variant-numeric: tabular-nums`） | 同 | |
| 符号 | 自定义 icon font 或 SVG：天干地支、八卦、行星/星座符号（Noto Sans Symbols 2 作后备） | | |

字号阶梯（移动 / 桌面）：`display 40/64`、`h1 28/40`、`h2 22/28`、`h3 18/22`、`body 16/17`（行高 1.75，中文正文）、`small 13/14`、`caption 12/12`。干支大字 `48/64`。

### 1.7 间距与圆角
4pt 基准：`space-1..12 = 4,8,12,16,20,24,32,40,48,64,80,96`；卡片内边距 20（移动）/ 24；圆角 `r-sm 8`、`r-md 14`、`r-lg 20`、`r-pill 999`。卡片边框 1px `--line-1`，悬停 `--line-2` + 轻微上浮 2px。

### 1.8 阴影与光
不使用灰黑阴影；用「光」：`--glow-gold: 0 0 24px rgba(212,175,106,0.25)`、`--glow-accent: 0 0 32px var(--accent-glow)`。重要元素（当前大限宫、动爻、抽中的牌）带呼吸光动画（3s 循环，opacity 0.6↔1）。

## 2. 星空（首页 Hero 与全局背景）

### 2.1 分层
1. **底层 CSS 渐变**：`radial-gradient(ellipse at 30% 20%, #0D1330 0%, #05070F 60%)` + 第二个淡紫光斑。
2. **CSS 星点层**（始终存在，降级也有）：两张 `box-shadow` 生成的星点层（200 + 100 点）缓慢平移（120s / 180s 循环），`prefers-reduced-motion` 下静止。
3. **Three.js 层**（仅首页 Hero 与占星 3D 盘，idle 后懒加载）。

### 2.2 Three.js 星空规范（`StarfieldCanvas`）
- 数据：BSC5 公版星表预处理为 `stars.bin`（≤ 9,110 星：ra, dec, mag, B-V 色指数），按真实位置渲染为 `THREE.Points`（自定义 ShaderMaterial：按星等映射点大小 1.5–4px 与亮度，按 B-V 映射色温白-蓝-黄-橙，加 soft sprite）。
- 相机：在天球内部，默认朝向用户所在地此刻的天顶方向（用 `astronomy-engine` 算 LST 与纬度 → 旋转），缓慢自转（每分钟 0.25°）。匿名或无地点 → 固定 UTC 0°。
- 行星：日月与五大行星按此刻真实位置放大标注（小光点 + 名称，hover 显示）。
- 银河：一张 4K 的低饱和银河贴图（公版 ESO/NASA 需核实许可；若不确定则用程序噪声生成的银河带）作为天球内壁，opacity 0.35。
- 流星：每 8–20s 随机一条，1.2s 划过。
- 鼠标/陀螺仪：视差 ±3°（移动端可选，默认关闭以省电）。
- 性能：`powerPreference: 'low-power'`，DPR 上限 1.5，`frameloop='demand'` 在非可见时停止；单帧预算 ≤ 8ms 中端手机；监测 60 帧平均 fps < 30 → 自动降级为 CSS 层并记一次事件。
- 降级条件（任一）：无 WebGL2、`navigator.deviceMemory < 4`、`prefers-reduced-motion`、`navigator.connection.saveData`、用户设置「减少动效」。

### 2.3 粒子（局部）
- 推演过场、翻牌、起卦成功时用 **CSS/Canvas 2D 粒子**（不启动 Three.js）：金色微粒 40–80 个，上浮 + 淡出，600–900ms。
- 实现统一在 `useParticles(ref, preset)`，预设：`sparkle`（金）、`ink`（墨滴，东方）、`stardust`（紫白，西方）。

## 3. 各体系的标志性视觉

| 体系 | 标志性组件 | 视觉描述 |
|---|---|---|
| 八字 | 四柱光柱 | 四根竖排卡片，天干在上、地支在下，字用文楷 48px，每柱底色为其五行色的 8% 透明叠加，柱间有细金线连接合/冲关系；入场从下往上"升起"（stagger 80ms）；五行环为 5 段圆环，段长按比例，中心日主字发光 |
| 紫微 | 十二宫方盘 | 4×4 格，格线金色 1px，宫名用印章式小标签；主星金色、辅星月白、煞星朱砂；当前大限宫呼吸光；点击宫 → 三方四正金线连接；移动端缩略 + 全屏手势缩放 |
| 周易 | 六爻生成 | 爻为 4px 高、金色线段（阳）或两段（阴），自下而上逐爻淡入 + 墨滴粒子；动爻外圈旋转虚线圆；本卦→变卦 Y 轴翻转过渡；铜钱 3D（CSS）正面「乾隆通宝」风格自绘，反面满文风格纹样 |
| 奇门 | 九宫点亮 | 3×3 深色格，四层信息依次点亮（地盘干 → 天盘干与星 → 门 → 神），每层 300ms；用神宫金色描边 + 标签；外圈罗盘八方位 |
| 塔罗 | 牌与扇形 | 牌背：深紫底 + 金色几何（八角星 + 月相环）；扇形展开 25 张可见，弧度 140°；翻牌 `rotateY` 600ms cubic-bezier(0.2,0.8,0.2,1)，翻转中边缘金光；逆位牌翻开后再旋转 180°（300ms）；牌阵位置有虚线占位 |
| 占星 | 轮盘 | 外环星座带（12 色低饱和）、宫位扇形、行星符号金色、相位线按类型着色；入场：外环旋转到位（800ms）→ 行星沿黄道飞入（stagger）→ 相位线绘制（stroke-dashoffset 动画）；3D 模式：天球线框 + 黄道带 + 行星光点，可拖拽 |
| 吠陀 | 南印度方格 | 4×4 固定格，藏红色 Lagna 斜线，行星缩写古金色；D1/D9 切换翻页动效；Dasha 轴为渐变色带 |
| 每日 | 星级与幸运行 | 星级为金色五星填充动画（每星 80ms）；幸运色为真实色块圆点 + 名称；Do/Don't 为朱砂/墨色 chips |

## 4. 动效规范

- 时长：微交互 120–200ms；元素入场 300–500ms；仪式类 600–1200ms；过场 ≥ 1200ms。
- 缓动：`--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1)`；`--ease-in-out: cubic-bezier(0.65, 0, 0.35, 1)`；弹性仅用于翻牌落位。
- 列表 stagger 40–80ms，最多 12 项。
- 页面切换：淡入 + 上移 12px（Framer `AnimatePresence`）。
- 滚动触发：章节进入视口时标题金线从左划出（400ms）。
- `prefers-reduced-motion` 与用户设置：全部替换为 150ms 淡入；Three.js 关闭；粒子关闭；翻牌改为直接显示。
- 音效（默认关）：翻牌、洗牌、铜钱落、起卦成、每日星级填满；全部 ≤ 1.5s、-14 LUFS、OGG+MP3；首次开启需用户手势。

## 5. 图标与插画
- 图标：Lucide（UI）+ 自绘命理符号集（SVG sprite，stroke 1.5px）：十天干十二地支（篆体感简化）、八卦、十四主星符号（自设计抽象符号）、九星八门、行星与星座（Unicode 符号的统一重绘版本）、Nakshatra 27 个（点阵星图）。
- 插画：七体系卡片用线稿 + 金色点光（东方：水墨线；西方：铜版画线），SVG，可动。
- 分享卡：1080×1920（竖）与 1200×630（横），背景星空静态图 + 主题纹理 + 金色边框；信息层级：品牌 → 标题 → 核心图（四柱/盘面缩略/牌）→ 关键词/星级 → 二维码 + 域名。字体内嵌子集。

## 6. 组件视觉规格（节选）

### 按钮
- Primary：`--accent` 底、白字、r-pill、高 48（移动）/44；hover 亮度 +6% + glow；active 缩放 0.98。
- Secondary：透明底、`--line-2` 边、`--text-1` 字；hover 边变 `--accent-2`。
- Ghost / Link：金色文字。
### 卡片
`--surface-1` + 纹理 + 1px 边；标题 h3 + 右上角可选印章标签。
### 术语 chip
虚线下划线 `--gold` 0.5 透明度；hover 实线；点击弹层 `--surface-2` 玻璃，宽 ≤ 320，含术语 zh/en、一句解释、「了解更多」。
### 星级
5 个金色五角星 SVG，未满为 `--line-2` 描边；辅以文字（"四星：顺遂"）。
### 广告容器
`--surface-1` 底，上方小字「广告」，固定高，圆角 r-md；绝不与主按钮相邻。

## 7. 性能预算（与 09 一致）
- 首页 LCP 元素 = Hero 品牌字（文本），不是 canvas；canvas 在 LCP 后挂载。
- Three.js chunk 懒加载（`requestIdleCallback` 或 3s 后）；占星 3D 仅在用户点击「3D」时加载。
- 字体子集：文楷子集 ≤ 180KB、Noto Serif SC 子集 ≤ 300KB（分两段：首屏 UI 字 + 延迟正文字），Cinzel ≤ 40KB，Cormorant ≤ 60KB。
- 图片 AVIF/WebP，塔罗牌 600px 高 ≤ 40KB/张，首屏不加载牌面。
- 动画只用 transform/opacity；避免 layout 动画；长列表虚拟化。

## 8. 质量验收（视觉）
- 七个标志性组件各有 Playwright 截图基线（zh/en × 移动/桌面）。
- Lighthouse Accessibility ≥ 90。
- 在 iPhone 12 Safari 与中端 Android（如 Pixel 6a）实机上：首页 Hero ≥ 45fps，报告页滚动无掉帧。
- Owner 视觉验收点：首页 Hero、八字报告页、紫微盘、塔罗翻牌、占星轮盘、每日运势、分享卡 —— 以 HTML 原型（docs/prototypes，若制作）为对照。
