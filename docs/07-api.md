# 07 · API 设计

> 以 Next.js Server Actions 为主（表单与页面内操作），Route Handlers 用于 webhook、图片生成、导出、健康检查与需要被外部调用的接口。所有接口 Zod 校验；所有错误用统一 `ApiError`。

## 1. 通用约定

- 基础路径 `/api/v1/*`（Route Handlers）。Server Actions 位于 `apps/web/app/**/actions.ts`，命名 `xxxAction`。
- 鉴权：Auth.js session cookie；匿名允许的接口标 `[anon]`；管理接口要求 `role=admin` 标 `[admin]`。
- 响应：`{ ok: true, data }` 或 `{ ok: false, error: { code, message, details? } }`。HTTP 状态：400 校验、401 未登录、403 无权限、404、409 冲突、422 引擎错误、429 限流、500。
- 限流（Upstash Ratelimit，滑动窗口）：匿名按 IP，登录按 userId。

| 路由组 | 限额 |
|---|---|
| 排盘/报告创建 | 匿名 20/小时；免费 60/小时；会员 200/小时 |
| 每日运势 | 120/小时 |
| 分享图生成 | 30/小时 |
| 魔法链接发送 | 5/小时/邮箱 + 20/小时/IP |
| 反馈 | 30/小时 |

- 幂等：创建报告接口接受 `Idempotency-Key`（客户端生成 UUID），Redis 记录 10 分钟。
- 国际化：接口本身不返回自然语言（除报告内容），错误 `message` 为英文开发者信息，前端用 `code` 映射文案。
- 时间：ISO 8601 + IANA 时区字段分离；绝不接受无时区的本地时间字符串。

## 2. 错误码

| code | 场景 |
|---|---|
| `E_VALIDATION` | 入参不合法（details: zod issues） |
| `E_UNAUTHORIZED` / `E_FORBIDDEN` | |
| `E_NOT_FOUND` | |
| `E_RATE_LIMITED` | 带 `retryAfter` |
| `E_PROFILE_REQUIRED` | 功能需要出生档案 |
| `E_REQUIRES_BIRTH_TIME` | 来自引擎 |
| `E_DATE_OUT_OF_RANGE` / `E_LUNAR_NO_LEAP_MONTH` / `E_UNSUPPORTED_SCHOOL` / `E_EPHEMERIS` | 来自引擎 |
| `E_AGE_RESTRICTED` | 出生年份推算年龄 < 13（COPPA），不创建任何数据 |
| `E_QUOTA_EXCEEDED` | 免费用户历史上限等 |
| `E_PAYMENT` | Stripe 错误 |
| `E_INTERNAL` | |

## 3. 接口清单

### 3.1 认证（Auth.js 托管）
- `GET/POST /api/auth/*`：Auth.js 标准路由（Google、Email）。
- 邮箱登录自定义发送：`sendMagicLinkAction(email, locale)` → Resend 模板（zh/en），链接 15 分钟。
- 登录回调后：若请求携带 cookie `anon_import=1`，前端在首页触发 `importAnonymousDataAction(payload)`。

### 3.2 档案
| 名称 | 类型 | 入参 | 出参 | 说明 |
|---|---|---|---|---|
| `getProfileAction()` | SA | — | `BirthInput & { version, timeUnknown }` | 解密返回当前档案 |
| `upsertProfileAction(input: BirthInput)` | SA | BirthInput | `{ profileId, version, warnings[] }` | 年龄 < 13 → `E_AGE_RESTRICTED`；创建新版本并 `isCurrent` 切换；返回引擎 normalize 的 warnings（如 DST 提示） |
| `deleteProfileAction()` | SA | — | ok | 删除所有版本与关联报告（二次确认在前端） |
| `GET /api/v1/geo/search?q=&locale=` | RH [anon] | 城市名 | `[{ name, country, admin, lat, lng, tz }]` | 城市搜索（见 §4） |
| `GET /api/v1/geo/tz?lat=&lng=` | RH [anon] | 经纬 | `{ tz }` | 经纬 → 时区 |

### 3.3 排盘与报告
| 名称 | 类型 | 入参 | 出参 |
|---|---|---|---|
| `createReadingAction(req)` | SA [anon] | `{ system, birth?: BirthInput (匿名必传；登录可省略用档案), options?, question?, category?, spread?, method?, numbers?, throws?, seed?, idempotencyKey }` | `{ readingId? , chart, report, meta }`：登录用户持久化并返回 `readingId`；匿名用户不持久化，返回完整结果供前端本地保存 |
| `getReadingAction(id)` | SA | id | Reading（仅 owner 或 public） |
| `listReadingsAction({ system?, cursor?, limit })` | SA | | 分页列表（标题、系统、时间、概览关键词） |
| `renameReadingAction(id, title)` | SA | | |
| `deleteReadingAction(id)` | SA | | |
| `regenerateReportAction(id, locale)` | SA | | 用最新知识库重算 report（chart 不变） |
| `POST /api/v1/compute` | RH [anon] | 同 createReading 的无 PII 子集（仅用于客户端离线回退时服务端兜底计算） | chart only |

### 3.4 每日运势
| 名称 | 类型 | 入参 | 出参 |
|---|---|---|---|
| `getDailyAction({ date?: 'YYYY-MM-DD', tz })` | SA | 默认今天 | `DailyReport`（含 chart 与 report） |
| `getDailyRangeAction({ from, to, tz })` | SA | 最长 31 天 | `[{ date, overall, scores }]`（日历热力图用，P1） |

匿名用户：前端用 `@tianji/engine` + 打包知识库本地计算，不调接口。

### 3.5 分享
| 名称 | 类型 | 入参 | 出参 |
|---|---|---|---|
| `createShareLinkAction({ readingId, template, revealLevel, expiresIn? })` | SA | | `{ token, url }` |
| `revokeShareLinkAction(token)` | SA | | |
| `GET /s/[token]` | 页面 [anon] | | 公开报告页（按 revealLevel 渲染） |
| `GET /api/v1/og/share/[token]?format=story|landscape` | RH [anon] | | PNG（@vercel/og），缓存 `s-maxage=86400` |
| `GET /api/v1/og/daily?...` | RH | 签名参数 | 每日运势分享卡 PNG（参数经 HMAC 签名防伪造，且不含生日） |

### 3.6 账户与隐私
| 名称 | 类型 | 说明 |
|---|---|---|
| `updateSettingsAction({ locale?, theme?, soundOn?, reducedMotion?, tz?, name? })` | SA | |
| `GET /api/v1/me/export` | RH | 生成 JSON（档案解密 + 全部报告 + 订阅摘要），`Content-Disposition: attachment`；限 1 次/10 分钟 |
| `deleteAccountAction(confirmText)` | SA | `confirmText === 'DELETE'`；软删除、注销会话、撤销分享链接、Stripe 取消订阅（立即）；排队 7 天硬删 |
| `importAnonymousDataAction({ profile?, readings[] })` | SA | 匿名本地数据导入；readings 最多 50 条；对每条重新 `stripPII` 并校验 chart schema |

### 3.7 反馈
| `submitFeedbackAction({ readingId?, unitId?, sectionKey?, vote, text? })` | SA [anon 允许 vote，text 需登录] |

### 3.8 支付
| 名称 | 类型 | 说明 |
|---|---|---|
| `createCheckoutSessionAction({ price: 'monthly'|'yearly' })` | SA | Stripe Checkout（`mode: subscription`），`success_url=/me/billing?status=success` |
| `createPortalSessionAction()` | SA | Stripe Customer Portal |
| `POST /api/v1/stripe/webhook` | RH | 验签；处理 `checkout.session.completed`, `customer.subscription.updated/deleted`, `invoice.payment_failed` → 更新 `Subscription` 与 `User.plan` |

### 3.9 系统
| `GET /api/v1/health` | RH [anon] | `{ ok, db, redis, knowledgeVersion, engineVersion }` |
| `POST /api/v1/cron/daily-maintenance` | RH | `Authorization: Bearer CRON_SECRET`；硬删除到期账户、清理过期分享、回写 share views |

### 3.10 管理（详见 10）
- `admin.listUsers`, `admin.getUser`（不解密出生信息，仅显示 birthYear/tz/gender/plan）、`admin.setPlan`、`admin.softDeleteUser`
- `admin.listKu`, `admin.getKu`, `admin.saveKuDraft`, `admin.previewKu(fixture)`, `admin.publishRelease(notes)`
- `admin.getConfig`, `admin.setConfig`
- `admin.stats(range)`
- `admin.listFeedback`, `admin.deleteFeedbackText`

## 4. 地理搜索方案

- 内置离线城市库：GeoNames `cities15000`（约 2.5 万城市，CC BY 4.0）预处理为 JSON（name、asciiname、alternatenames 中英、country、admin1、lat、lng、timezone），约 3MB，放 Vercel Blob 或打包进服务端；搜索用前缀 + 拼音/英文/中文别名匹配，服务端 Fuse.js 或简单 trigram。
- 找不到时允许用户手输经纬度 + 选时区（下拉 IANA 列表）。
- 经纬 → 时区：`tz-lookup`（纯 JS）。
- **不**调用 Google Places / Nominatim 等外部服务，避免出生地外泄（决策 D17 的延伸）。

## 5. 客户端数据流（匿名模式）

```
localStorage['tianji.anon'] = {
  anonId, profile?: BirthInput, readings: [{ id, system, createdAt, chart, reportZh?, reportEn?, meta }] (≤ 50),
  settings
}
```
- 以 Web Crypto 用 `anonId` 派生密钥 AES-GCM 加密后存储（防止同机他人直接读取；安全性有限，前端提示"匿名数据只保存在本设备"）。
- 登录后弹窗导入，成功后清除本地。

## 6. 示例

`createReadingAction` 请求（登录用户，八字）：
```json
{ "system": "bazi", "options": { "school": { "ziHour": "zi_unified", "useApparentSolarTime": true } }, "idempotencyKey": "6f1c..." }
```
响应：
```json
{ "ok": true, "data": { "readingId": "clx...", "chart": { "pillars": { ... } }, "report": { "headline": { "persona": "…", "keywords": ["稳重","执着","慢热"], "scores": { "career": 4, "wealth": 3, "love": 3, "health": 4, "social": 3 }, "confidence": 0.92 }, "sections": [ ... ] }, "meta": { "schoolUsed": { ... }, "warnings": [] } } }
```

## B-10 补充

`createReadingAction` / 报告 API 的 `system` 支持 `numerology`，新增 `name?: string`（英文姓名，≤120 字符，可留空，字符限制见体系文档）。省略 birth 时复用当前加密档案；姓名原文仅存于加密 inputSnapshot，公开分享只展示派生生命灵数。
