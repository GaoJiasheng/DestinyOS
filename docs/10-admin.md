# 10 · 管理后台（一期最简版）

> 路由 `/admin/*`，仅 `role=admin`（`ADMIN_EMAILS` 白名单）。界面语言默认中文，可切英文。使用 shadcn/ui 表格与表单，不追求视觉花哨。所有写操作记录 `AdminAuditLog`。

## 1. 页面

| 路由 | 功能 | 关键约束 |
|---|---|---|
| `/admin` | 仪表盘：今日/7 日/30 日 DAU、新注册、报告生成数（按体系）、每日运势访问、分享生成、订阅数与 MRR（Stripe）、错误率（Sentry 链接） | 数据来自 `Event` 日聚合 + Stripe API 缓存 1 小时 |
| `/admin/users` | 搜索（邮箱/ID）、列表（邮箱、plan、locale、注册时间、最近活跃、报告数、状态）、详情 | **详情页不显示明文出生信息**，只显示 birthYear、tz、gender、timeUnknown、档案版本数；按钮：设为会员/取消、软删除、导出用户数据（生成下载链接发给用户邮箱而非直接显示） |
| `/admin/knowledge` | KU 列表：按体系/章节/状态筛选，搜索 unitId/标题；条目编辑器（左 YAML、右 zh/en 预览）；「在 Fixture 上预览」选择 Fixture A–G 生成该体系报告并高亮本条是否命中；保存为草稿；校验（同 CI 规则，实时显示错误） | 编辑产生新 version；发布走 Release |
| `/admin/knowledge/releases` | 创建发布：选择所有 draft → 预检（覆盖率、禁用词）→ 填写 notes → 发布 → 生成 `knowledgeVersion`，刷新 Redis bundle；历史版本列表与回滚 | 回滚 = 以旧版本重新发布 |
| `/admin/config` | SiteConfig 编辑：公告（zh/en、显示范围、起止时间）、`ads.enabled`、`feature.llmPolish`、`feature.panchangDefaultOpen`、维护模式 | 变更即时生效（Redis 缓存 60s） |
| `/admin/feedback` | 反馈列表（按 unitId 聚合 👍👎 比例、文本），删除文本、标记已处理、一键跳到该 KU 编辑 | 文本可能含用户信息，仅 admin 可见，30 天后自动脱敏（置空） |
| `/admin/audit` | 审计日志只读 | |

## 2. 权限与安全
- 进入 `/admin` 需 10 分钟内重新登录（re-auth 页）。
- 所有页面 `noindex`、`X-Robots-Tag: noindex`。
- 导出用户数据走邮件链接（15 分钟有效），避免管理员直接下载明文。
- 后台不接 AdSense。

## 3. 统计实现
- `Event` 表每日由 cron 聚合到 `EventDaily(day, name, system, locale, plan, count, uniques)`。
- 仪表盘读聚合表；实时数字用 Redis 计数器（当日）。

## 4. 验收
- [ ] 非 admin 访问 `/admin` 得 404（不暴露存在）。
- [ ] 编辑一条 KU → 预览命中 → 发布 → 前台新报告使用新版本；旧报告不变。
- [ ] 用户详情页抓包无 encBirth 解密值。
- [ ] 每个写操作有审计记录。
