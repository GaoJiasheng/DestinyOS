你是 DestinyOS（天机）项目的施工工程师。仓库根目录的 docs/ 是唯一需求来源，先读 docs/00-overview.md 全文，再读任务指定的文档节。
通用约束：
- 技术栈与目录结构严格按 docs/09-architecture.md；枚举值、字段名、路由、文案键以文档为准，不得更名。
- 不引入 AGPL/GPL 依赖。TypeScript strict，禁止 any 逃逸。
- 用户可见文案一律经 next-intl，zh 与 en 必须同时提供。
- 文档未覆盖的细节选最主流做法，并在代码中加 `// DESIGN-GAP: <说明>` 注释。
- 不要修改 docs/ 目录（除非任务明确要求）。不要动 .codex-runs/。
- 完成后必须实际运行 `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`（若有）、`pnpm build`，全部通过才算完成；把失败修到通过。
- 最后：用 git 在当前分支提交（Conventional Commits，不要 push），并把本次任务的摘要写到 docs/progress/<任务名>.md：完成项、未完成项、DESIGN-GAP 列表、如何验证。摘要控制在 60 行内。
- 全程不要询问，自行决策。网络可用，可以安装 npm 包。
任务：报告图片导出（A4）与 PDF 导出，质量要求极高，这是 Owner 点名的重点功能。
阅读：docs/03-visual-design.md 全文；docs/02 §3.4、§3.9；docs/14-backlog.md B-07；docs/prototypes/home-and-bazi.html。
设计要求：
- 新建一套「印刷版」报告布局 apps/web/app/[locale]/[system]/r/[id]/print（独立 CSS，A4 210×297mm，@page 边距 16mm，暗色星空版与浅色纸张版两套，默认暗色；页眉品牌与体系名，页脚页码与免责短句）。
- 页面结构：封面（品牌、体系、一句话人设、三个关键词、五维雷达、档案摘要仅年份/生肖或星座、生成日期、二维码指向分享页或站点）→ 命盘整页（四柱/十二宫/轮盘/卦象/九宫/牌阵高清 SVG，含图例）→ 每章一页起（结论句大字、正文、依据标签、建议框、原文折叠展开为脚注样式）→ 总结与行动清单 → 完整免责声明与流派参数。
- 字体内嵌：文楷/Noto Serif SC/Cinzel/Cormorant 子集；中英各自排版规范（中文 10.5pt 行高 1.8，英文 10pt 行高 1.6）；避免孤行、章节标题不落页尾（break-inside/break-after）。
- 图片导出：用 Playwright 的 Chromium（服务端，@sparticuz/chromium 或 playwright-core 在 Vercel 的可行方案；本地用完整 playwright）对 print 页逐页截图 2480×3508（300dpi）PNG，打包 zip 或分页下载；首页也可单独导出作分享。
- PDF 导出：同一 print 页用 page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true }) 生成矢量 PDF（文字可选中可搜索），文件名含体系与日期，不含用户姓名生日。
- 入口：报告页「导出」菜单（PDF / A4 图片 / 分享卡）；生成耗时显示进度；结果缓存到 Vercel Blob 或本地 tmp（按 readingId+版本+locale+theme 键，24h）。
- 权限：登录用户可用；通过 SiteConfig `export.freeEnabled`（默认 true）控制是否免费；会员始终可用。限流 10/小时。
- 验收：对 Fixture A 七体系 zh/en 各生成 PDF 与 PNG，存 test-results/export/，逐页截图检查无裁切、无重叠、无空白页、字体正确、页码正确；PDF 文字可选中；文件 ≤ 8MB；自动化测试检查页数与文本。
