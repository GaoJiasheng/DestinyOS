任务：多档案与合盘（docs/14 B-01、B-02）。
要做：
1. 多档案：BirthProfile 增加 label、isDefault、relation（self/partner/family/friend/other）；去掉每用户单档案约束；档案切换器（导航头像菜单与 /me/profiles 管理页：新增/编辑/删除/设默认，上限免费 3 个、会员 20 个）；所有体系与每日运势按当前选中档案计算；Reading 关联 profileId 已有；分享与导出沿用。
2. 合盘 system `synastry`：选择两个档案 → 八字合婚（日柱天干合/冲、日支六合/六冲、年柱生肖关系、五行互补度、配偶星互看、十神互动）、紫微合盘（双方命宫与夫妻宫主星互看、互入对方三方四正的四化）、西方 Synastry（行星两两相位表、对方行星落我宫、金火日月互动）、吠陀 Ashtakoot 36 Guna（Varna/Vashya/Tara/Yoni/Graha Maitri/Gana/Bhakoot/Nadi 完整表）；输出 chart schema；知识库约 250 条 KU（zh/en）；报告页：双盘并排/叠加可视化（合盘轮盘叠加、八字双四柱对照表、36 分仪表）、章节：整体契合、沟通、感情、价值观与金钱、冲突模式、长期建议；分享卡模板「合盘卡」。
3. 文档：docs/systems/synastry.md；测试：引擎单测（Ashtakoot 手算用例 3 组）、E2E 一条。
