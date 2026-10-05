# 报告图片导出（A4）与 PDF 导出

## 完成项
- 独立 `/[locale]/[system]/r/[id]/print`：A4、16mm 边距、暗色默认/浅色纸张、品牌页眉及页码免责页脚。
- 封面、三个关键词、五维雷达、仅年份/生肖或星座的档案摘要、生成日期与分享/站点二维码。
- 七体系高清 SVG 与图例、每章新页、结论/正文/依据/建议/原文脚注、完整行动清单、免责声明与流派参数。
- 内嵌文楷/Noto Serif SC/Cinzel/Cormorant 子集；中文 10.5pt/1.8、英文 10pt/1.6；补齐稀有字及星盘符号。
- Chromium 矢量可搜索 PDF、2480×3508/300dpi 无损 PNG、单独封面；ZIP 超限时提供逐页下载。
- 报告导出菜单、暗/浅色选择、分享卡入口、真实生成进度与错误/重试状态，中英 next-intl 文案齐全。
- 登录及所有权校验；会员可用；`export.freeEnabled` 默认 true，后台可切换；生成限流 10 次/小时。
- 按报告/内容/版本/locale/theme 隔离的 24h 私有 Blob 或本地 tmp 缓存；下载重新检查权限。
- 文件名不含姓名生日；导出不创建公开分享；修正遮罩污染截图、暗色对比度及 D1/D9 标题重叠。
- 导出验收加入 `test:export:e2e` 和总 E2E 链。

## 未完成项
- 无代码或本地验收未完成项；未执行生产部署及真实 Vercel Blob 联调。

## DESIGN-GAP
- 新增 owner-only `/api/export`，显式格式/主题参数；生成用 NDJSON 流，下载也用流式响应。
- 实际字体测量原子块分页，超长正文按词/字符拆分；最多 80 页，溢出拒绝生成，允许 1 CSS 像素舍入。
- 两套纸面 token 独立于系统主题；参数路径/枚举保留机器引用，其余文案经 next-intl。
- 塔罗采用有标签的 SVG 牌面标识，凯尔特交叉保留刻意交叠及独立标签；D9 内嵌盘加不透明纸面。
- 少于三个原有关键词时，补入已有高分维度标签；英文干支名缩小至固定柱宽内。
- 补齐正文稀有字、Latin/标点及 OFL 星盘符号；字体来源带固定哈希，保留授权文件。
- Chromium 仅访问固定站点 origin；短期签名请求头授权，支持 Vercel 预览保护 bypass。
- 服务端 Chromium 固定版本；web Node >=22.17，Vercel 使用支持的 LTS；构建已追踪二进制。
- 缓存额外绑定 owner/format/内容；本地原子写入和过期清理；二维码只选已有公开分享或站点。
- 原生 2480×3508 视口配 CSS zoom，逐页显隐截图；PNG 无损压缩并写入 300dpi 元数据。
- 每个 PDF/PNG/ZIP 不超过 8MB；长报告 ZIP 超限保留原始质量，改为独立缓存各页 PNG。

## 如何验证
- 已实际通过 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`。
- 全量单测：65 文件、3407 项；导出 E2E：5 项；双语键/ICU 和 947 包许可白名单检查通过。
- 先 `pnpm exec playwright install chromium`，安装 Poppler；再 `pnpm test:export:e2e`。
- Fixture A 七体系 zh/en：14 份暗色 PDF、276 张 300dpi PNG；另验收 2 份浅色 PDF、14 张浅色封面预览。
- 已逐页检查无裁切/重叠/空白页、字体与页码正确；自动验证页数、全部正文文本、内嵌字体及像素/dpi。
- 最大 PDF 849212 字节、PNG 1446544 字节、ZIP 7611087 字节，均低于 8000000 字节。
- 产物与检查记录在 `test-results/export/`；汇总 `acceptance-summary.json`，逐页缩略图在 `qa/`。
- 本地安装完整 Playwright Chromium；Vercel 持久缓存配置私有 Blob 的 `BLOB_READ_WRITE_TOKEN`。
