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
