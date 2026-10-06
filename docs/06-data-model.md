# 06 · 数据模型（Prisma / Cloudflare D1（SQLite））

> 原则：出生信息与问题文本为**加密列**（应用层 AES-256-GCM，见 08）；排盘结果与报告为明文 JSON（不含可识别信息：chart 中不存姓名、具体生日，仅存派生要素；为保险，chart JSON 入库前经 `stripPII()` 删除 `input`/`local` 字段，保留 `solarTimeAdjust.offsetMinutes` 等数值）。

## 1. ER 概览

```
User 1─1 BirthProfile(版本化) 1─n Reading
User 1─n Account / Session (Auth.js)
User 1─1 Subscription
User 1─n ShareLink ─1 Reading
User 1─n Feedback
KnowledgeUnit (版本化) 独立
DailyCache 独立（KV 缓存；D1 为强一致状态）
AdminAuditLog
Event（匿名统计）
```

## 2. schema.prisma

```prisma
generator client { provider = "prisma-client-js"; engineType = "client" }
datasource db { provider = "sqlite"; url = "file:./local.db" }


model User {
  id            String   @id @default(cuid())
  email         String?  @unique
  emailVerified DateTime?
  name          String?           // 显示名（来自 OAuth 或用户设置），非敏感
  image         String?
  role          String     @default("user")
  plan          String     @default("free")
  locale        String   @default("zh")
  tz            String?           // 最近一次浏览器上报时区
  theme         String?           // 'auto'|'east'|'west'
  soundOn       Boolean  @default(false)
  reducedMotion Boolean  @default(false)
  anonId        String?  @unique  // 导入匿名数据时记录来源，去重
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?         // 软删除；7 天后 cron 硬删除
  accounts      Account[]
  sessions      Session[]
  profiles      BirthProfile[]
  readings      Reading[]
  subscription  Subscription?
  shareLinks    ShareLink[]
  feedbacks     Feedback[]
  @@index([deletedAt])
}

// Auth.js 标准表
model Account { ... }        // 按 @auth/prisma-adapter 模板
model Session { ... }
model VerificationToken { ... }

model BirthProfile {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  version      Int      @default(1)      // 每次编辑 +1；旧版本行保留 isCurrent=false
  isCurrent    Boolean  @default(true)
  // ---- 加密列：ciphertext 格式 "v<keyVersion>:<iv b64>:<tag b64>:<data b64>" ----
  encBirth     String                     // JSON {calendar, year, month, day, isLeapMonth, hour, minute, timeUnknown}
  encPlace     String?                    // JSON {name, lat, lng, tz}
  encName      String?                    // 用户给该档案起的名字（一期只有"我"）
  // ---- 明文派生字段（低敏感，用于查询/统计/缓存键，不足以反推生日）----
  gender       String
  timeUnknown  Boolean
  tz           String                     // 出生地时区（IANA），用于每日运势默认时区
  birthYear    Int                        // 年龄门槛检查（<13 阻断）与粗粒度统计；不存月日
  chartHash    String                     // sha256(规范化出生输入 + 流派参数)，用作排盘缓存键
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  readings     Reading[]
  @@unique([userId, version])
  @@index([userId, isCurrent])
}

model Reading {
  id                String        @id @default(cuid())
  userId            String?                           // 匿名导入前为 null（仅在导入时创建）
  user              User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  profileId         String?
  profile           BirthProfile? @relation(fields: [profileId], references: [id], onDelete: SetNull)
  system            String
  status            String @default("ok")
  // 输入快照（加密）：出生输入 + 问题 + 牌阵/起卦参数 + seed
  encInput          String
  // 明文：去 PII 的排盘与报告
  chart             Json
  reportZh          Json?
  reportEn          Json?
  schoolUsed        Json
  engineVersion     String
  interpretVersion  String
  knowledgeVersion  String
  profileVersion    Int?
  title             String?                           // 用户可改的标题（如"关于换工作的占卜"），加密不必要但不含 PII 要求：前端提示勿填个人信息
  isPublic          Boolean       @default(false)
  createdAt         DateTime      @default(now())
  shareLinks        ShareLink[]
  feedbacks         Feedback[]
  @@index([userId, createdAt(sort: Desc)])
  @@index([userId, system])
}

model ShareLink {
  id          String   @id @default(cuid())
  token       String   @unique          // 22 字符 base62
  readingId   String
  reading     Reading  @relation(fields: [readingId], references: [id], onDelete: Cascade)
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  template    String                     // 分享卡模板 key
  revealLevel Int      @default(0)       // 0 仅结论与年份/星座；1 加四柱/盘面；2 加完整报告
  views       Int      @default(0)
  expiresAt   DateTime?
  createdAt   DateTime @default(now())
  revokedAt   DateTime?
}

model Subscription {
  id                   String   @id @default(cuid())
  userId               String   @unique
  user                 User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  stripeCustomerId     String   @unique
  stripeSubscriptionId String?  @unique
  stripePriceId        String?
  status               String                 // Stripe 状态原文：active, trialing, past_due, canceled, ...
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean  @default(false)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt
}

model KnowledgeUnit {
  id         String   @id @default(cuid())
  unitId     String                         // 如 bazi.day_master.jia.strong
  version    Int
  system     String
  section    String
  topic      String
  status     String @default("draft")
  yaml       String                         // 原始 YAML 文本（单条）
  compiled   Json                           // 解析后的对象
  weight     Int
  polarity   String
  author     String?
  reviewedBy String?
  createdAt  DateTime @default(now())
  publishedAt DateTime?
  @@unique([unitId, version])
  @@index([system, status])
}

model KnowledgeRelease {
  id        String   @id @default(cuid())
  version   String   @unique                // knowledgeVersion
  notes     String?
  createdBy String
  createdAt DateTime @default(now())
}

model Feedback {
  id        String   @id @default(cuid())
  userId    String?
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  readingId String?
  reading   Reading? @relation(fields: [readingId], references: [id], onDelete: SetNull)
  unitId    String?                          // 针对某段 KU 的反馈
  sectionKey String?
  vote      Int                              // +1 / -1
  text      String?                          // ≤ 500 字，前端提示勿含个人信息；后台可删
  createdAt DateTime @default(now())
  @@index([unitId])
}

model SiteConfig {
  key       String   @id                     // 'announcement', 'ads.enabled', 'feature.llmPolish' ...
  value     Json
  updatedBy String
  updatedAt DateTime @updatedAt
}

model AdminAuditLog {
  id        String   @id @default(cuid())
  adminId   String
  action    String                           // 'ku.publish', 'user.delete', 'config.update'
  target    String?
  diff      Json?
  createdAt DateTime @default(now())
}

model Event {                                 // 匿名产品统计（不存 userId 明文，存 hash 日盐）
  id        Int   @id @default(autoincrement())
  day       DateTime
  name      String                           // 'reading.created', 'daily.viewed', 'share.created', 'sub.started'
  system    String?
  locale    String?
  plan      String?
  userHash  String?                          // sha256(userId + daySalt)，仅用于日 DAU 去重
  props     Json?
  @@index([day, name])
}
```

## 3. 加密列约定

- 加密函数 `encryptField(plain: string): string` / `decryptField(cipher: string): string`（`apps/web/lib/crypto.ts`），算法 AES-256-GCM，随机 12 字节 IV，AAD = 列名（如 `"BirthProfile.encBirth"`），输出 `v<kv>:<iv>:<tag>:<data>`。
- 密钥来自 `FIELD_ENCRYPTION_KEYS`（多版本，支持轮换：读时按前缀选 key，写时用首个）。
- Prisma 层用 **Client Extension** 自动加解密标注字段（`$extends` query 拦截 `BirthProfile`/`Reading` 的 `encXxx`），业务代码永远操作明文对象 `BirthInput`，不接触密文。
- **禁止**在 `where` 中使用加密列；需要查询用 `chartHash`、`birthYear`、`tz`。

## 4. 数据保留与删除

| 数据 | 保留 |
|---|---|
| 账户、档案、报告 | 账户存续期间；软删除后 7 天硬删除（cron） |
| 匿名用户数据 | 不入库（浏览器本地） |
| ShareLink | 用户撤销或账户删除时失效；默认永不过期（用户可设 7/30 天） |
| Feedback.text | 账户删除时置空 userId，保留匿名文本用于改进（隐私政策注明）；用户可在删除账户时勾选"一并删除我的反馈" |
| Event | 永久（已匿名） |
| Session | Auth.js 默认 30 天 |
| Stripe 对象 | 由 Stripe 保存；本地仅存 id 与状态 |
| 日志 | 30 天（Cloudflare/Sentry 设置） |

## 5. 索引与性能

- `Reading` 按 `(userId, createdAt desc)` 分页；免费用户仅保留最近 50 条（写入时若超过则删除最旧的非公开报告；会员无限）。
- `KnowledgeUnit.compiled` 加载：按 `(system, status=published)` 一次取最新版本（用窗口函数或在 `KnowledgeRelease` 发布时写一张物化表 `knowledge_bundle(system, locale, version, json)`，运行时只读这张表并缓存到 KV）。
- `chart` JSON 平均 20–60KB（紫微最大），`report` 30–80KB；Reading 单行 ≤ 300KB，D1 单行预算 2MiB；报告不超过此限制。

## 6. Cloudflare 原生状态与缓存

| key | 值 | TTL |
|---|---|---|
| `daily:{userId}:{profileId}:{profileVersion}:{date}:{locale}:{kv}:{ev}` | DailyReport JSON | 至当地次日 02:00 |
| `chart:{system}:{chartHash}:{ev}` | Chart JSON（本命类复用） | 30 天 |
| `knowledge:{kv}:{system}:{locale}` | 知识库 bundle | 1 小时（immutable release 保留在 D1） |
| `rl:{route}:{identity hash}` | RateLimitHit D1 原子滑动日志；binding 负责 60 秒突发 | 1 小时 |
| Auth.js VerificationToken | D1 单次原子消费，按 expires 验证 | 15 分钟 |
| `share:views:{token}:{date}` | KV 近似计数，定期汇总回 D1 | 72 小时 |

## 7. 迁移策略

- 所有 schema 变更由 `prisma migrate diff` 生成 SQLite SQL，放在 `apps/web/migrations/`；分别用 `wrangler d1 migrations apply destinyos --local` 与 `--remote` 应用。禁止 `db push` 到生产；原 `prisma/migrations/` 为 PostgreSQL 历史，不再执行。
- 加密密钥轮换：新增 key 到环境变量首位 → 运行脚本 `scripts/rotate-keys.ts` 逐行解密重加密 → 移除旧 key。

## B-10 补充

Prisma `System` 增加 `numerology`；现为 TEXT 值，由共享 TS/Zod 联合类型与数据库触发器校验，不更名。`Reading.encInput` 加密保存可选英文姓名 `name`，chart 仅保存派生总和与数字；姓名不进入明文 report 或分析事件。

## Cloudflare 原生迁移（CF-NATIVE，Owner 决定覆盖旧平台选型）

- 生产 ORM：Prisma 6.19.3 `engineType="client"` + `@prisma/adapter-d1`，绑定 `DB`；本地 Node 使用 `@prisma/adapter-better-sqlite3`。
- SQLite 枚举列均为 String，值保持不变（含 `zh-TW`、`synastry`）；共享 TS/Zod 联合类型校验读写，关键列另有 SQL 约束。Json 保留 Prisma Json，SQLite 存 JSON 文本；关系数组仍是关系，无标量数组。
- Event.id 改 Int 自增；DateTime 统一 UTC ISO 8601（adapter 格式 `+00:00`），原 `@db.Date` 以 UTC 午夜日期代替；保留 DESC 索引、布尔默认值与级联关系。
- D1 adapter 的交互事务不具备 ACID 保证，生产业务禁止依赖它；多表更新走 `DB.batch()`，原子预条件由 BatchGuard CHECK 保护，失效则整批回滚。本地执行同组 SQL 的 SQLite 事务。
- EphemeralState(key,value,expiresAt) 保存锁、报告幂等、导出 token 和一次性预约；RateLimitHit(id,key,expiresAt) 保存小时滑动日志；ChatQuota 使用条件 UPSERT 防超额。
- VerificationToken 留在 Auth.js 标准 D1 表；到期 token、临时状态、限流日志和旧 ChatQuota 由每日 scheduled 清理。
- CACHE KV 保存每日运势、知识库 bundle、配置和分享近似访问计数；不用于锁、token 或配额。
- KnowledgeRelease.bundles 保存分块清单；KnowledgeBundleChunk(releaseVersion,system,ordinal,data) 保存每体系 gzip/base64 的 512KiB 分块，在同一发布批次内提交；读取还原原 JSON。避免 D1 单行 2MiB 上限。
- AES-256-GCM、AAD、密钥版本、每用户密钥派生与 stripPII 逻辑不变；原子 SQL 写入调用相同加密函数。
