任务：上线前打磨（视觉与内容质量）。
阅读：docs/03-visual-design.md 全文；docs/02-information-architecture.md §3；docs/05-interpretation-engine.md §7–§8；docs/prototypes/home-and-bazi.html（视觉对照）。
要做：
1. 启动本地完整环境（docker compose 的 postgres/redis 或测试替身），用 Playwright 对以下页面在 375px 与 1280px、zh 与 en 各截图：首页、出生表单两步、七个体系的报告/结果页（用 Fixture A；占卜类用固定 seed）、每日运势、分享弹层与公开页、我的、设置、定价、学习百科的一张牌与一卦、登录页。截图存 test-results/polish/。
2. 逐张对照 docs/03 与原型检查并修复：token 使用是否一致、主题是否按路由切换、字体是否生效（文楷大字干支/卦名、Cinzel 英文标题）、对比度、移动端是否有横向溢出、触控目标 ≥44px、入场动效与 reduced-motion 降级、广告容器占位、空/加载/错误/无时辰状态是否都渲染正确。
3. 报告内容质量：对 Fixture A 七体系与 B、D、E 三个档案生成 zh/en 报告，检查：每章非空、结论句存在、术语 chip 有弹层、依据标签可点击高亮命盘、无 {{ 占位、无禁用词、过渡词不重复、zh/en 无语言残留、字数达标；发现知识库缺口直接补 KU 并通过 content:validate。
4. 交互走查并修复：塔罗仪式全流程、六爻摇卦、梅花报数、奇门起局、紫微盘点击三方四正、占星轮盘点击联动与宫位制切换、日期切换手势、分享下载、语言切换保持路径、删除账户流程。
5. 把发现与修复清单写入 docs/progress/POLISH.md（含截图路径），提交。
