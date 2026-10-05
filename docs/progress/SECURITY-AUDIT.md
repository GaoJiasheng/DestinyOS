# SECURITY-AUDIT · 安全审计与修复

需求：00 全文、08 全文、07 §1–§2；架构与字段按 09/06，日期 2026-10-05。
表中 lib/app 路径相对 apps/web，测试位于 apps/web/test（security-input 位于 packages/shared/test）。
完成项：认证、字段加密/轮换、授权、限流、分享/OG、脱敏、安全头、输入边界、SSRF/路径、依赖、支付、SQL、匿名存储全部审计；每个新高危项已有回归测试。

| ID/严重度 | 位置与发现 | 修复 | 验证方法 |
| --- | --- | --- | --- |
| S01 高 | `apps/web/lib/auth.ts` Google 默认仅 PKCE，未检查 OAuth state | 显式启用 state、PKCE、OIDC nonce | `oauth-security.test.ts`：真实 Auth.js 发起流程，缺失/伪造 state 在 token 交换前失败 |
| S02 高 | `lib/db-encryption.ts` upsert 更新分支可改归属/绕过 owner 过滤 | 更新分支统一禁止归属变化，加密更新要求 where.userId | `db-encryption.test.ts`：真实数据库拒绝变更，原密文不变 |
| S03 高 | `lib/ratelimit.ts` Upstash 超时默认 success=true | 超时返回 E_INTERNAL/503，禁止继续处理 | `security-audit.test.ts`：注入 timeout-success，邮件限流/OG 均不放行 |
| S04 高 | `lib/privacy.ts` 编码 URL、裸出生字段、嵌套 body 可外泄 | 有界解码，扩展敏感字段/凭据参数脱敏 | `security-audit.test.ts`：1000 行实际 pino 输出及 Sentry 事件无注入 PII |
| S05 高 | `api/v1/og/share/[token]/route.ts` CDN 缓存使撤销后仍可访问旧图 | private/no-store，每次重新检查分享 | `security-audit.test.ts`：检查缓存头，撤销后 404 且不渲染 |
| S06 中 | 多处 action/IP 取值不同；feedback 使用完整转发链 | 统一 requestIp：生产仅信任 Vercel、IP 校验和 IPv6 规范化 | `security-audit.test.ts`：伪造非 Vercel 转发、链尾和等价 IPv6 不产生新身份 |
| S07 中 | `app/readings/actions.ts` 授权前读取/解密报告，存在 ID 枚举差异 | SQL 按 id+owner 查询，缺失/外人统一拒绝；反馈同样 owner 限定 | `reading-actions.test.ts`：未授权不读数据库，外人查询包含 owner、不调用无过滤读取 |
| S08 中 | OG 路由、重新解读/翻译/匿名导入可绕过计算配额 | 图片渲染独立限流；重算、翻译、每条新增导入共享报告额度 | `security-audit.test.ts`、`reading-actions.test.ts`：429/配额失败前不渲染或解释 |
| S09 中 | `lib/security-headers.ts` Report-Only 的 frame-ancestors 不阻止嵌入 | 增加 DENY 和强制基线 CSP；脚本策略继续按 08 采样 | `m4-security.test.ts`：强制 CSP/X-Frame-Options，生产脚本策略无 unsafe-eval |
| S10 低 | 出生地标签无上限、时区/每日日期校验不足、空坐标被转为 0 | 城市标签 200 字、IANA 校验、合法日期、非空坐标；结构化提问同样 120 字限制 | `security-input.test.ts`、`geo.test.ts`：拒绝超长/非法/空值 |
| S11 中 | Vitest/mocker CVE-2026-84373 仍在忽略清单 | 升级 Vitest/coverage-v8 至 4.1.11，删除该忽略项 | `pnpm audit`、完整覆盖率测试、`licenses:check` |

信息项 I01（`lib/anonymous-storage.ts`）：anonId 与密文同存，整份浏览器存储泄露即可派生密钥；按 07 §5 明确的有限安全模型保留，AES-GCM 篡改/IV 回归已验证，不能作为 XSS 或设备入侵防线。

未发现可利用问题的检查与证据：
- 魔法链接：15 分钟、数据库原子删除 token；GET 扫描只显示确认页；认证 E2E 验证重放/过期失败、会话撤销立即生效。
- 会话：Auth.js 服务端随机生成数据库 sessionToken，生产 Secure/HttpOnly/SameSite=Lax；Google 管理员重认证撤销原会话，`m5-admin.test.ts` 校验白名单+角色+10 分钟+归属。
- 加密：AES-256-GCM 随机 96-bit IV、table.column AAD、HKDF-SHA256 按 owner 派生；`crypto.test.ts` 覆盖 IV/AAD/owner/篡改；真实 DB dump 无明文。
- 轮换：真实脚本以 500 行 Serializable 事务重读；`db-encryption.test.ts` 实测 501 行、坏密文整批回滚、重跑后可移除旧 key；脚本不输出 PII。
- IDOR：读/删/改报告、创建/撤销分享、recipient-only 导出均按 owner；`reading-actions.test.ts`、`security-authorization.test.ts`；cron GET/POST 无正确 bearer 时无维护 IO。
- 分享：22 位均匀 base62 ≈131 bit，严格格式/失效检查/noindex；默认 revealLevel=0 白名单投影；`daily-share.test.ts` 验证 HTML/OG 公共投影无生日、问题、地点；daily HMAC 拒绝篡改/过期。
- SSRF/路径：城市库、字体与导出文件名均固定本地路径，OG 只嵌入二维码，无用户 URL fetch；`geo.test.ts` 实测元数据地址、file URL、../ 为无害查询且不联网。
- SQL/支付：全仓无 queryRawUnsafe/executeRawUnsafe，原始查询均 Prisma 标签参数绑定；`stripe-webhook.test.ts` 验证原始正文签名、重复/并发/失败重试及最新订阅状态。
- 匿名存储：按 07 §5 使用 anonId 派生 AES-GCM，IV 每次随机、AAD 固定、schema 校验与篡改拒绝（`anonymous-storage.test.ts`）；anonId 随 envelope 保存，不能抵御取得完整浏览器存储或 XSS 的攻击，此为文档明确的有限安全模型。
- 依赖：audit 修复前 6 条，修复后保留 4 条既有例外：next-intl 两条仅影响未启用配置，extract-zip 两条已本地补丁；`security:policy` 和 ZIP 回归验证，未新增 GPL/AGPL。

DESIGN-GAP（本次新增/调整）：
- `auth.ts`：明确指定 state/nonce；`db-encryption.ts`：upsert 更新采用不可变 owner。
- `ratelimit.ts`：基础设施超时 fail closed；`request-ip.ts`：Vercel 以外生产代理共用安全 fallback，部署迁移需可信代理接入。
- `readings/actions.ts`：统一计算额度，未知/越权 ID 使用一致响应。
- `privacy.ts`：最多三轮 URL 解码；`security-headers.ts`：脚本采样期先强制基线策略。
- OG share：即时撤销优先于 07 的一天图片缓存；代价是减少 CDN 命中。
- `birth.ts`：城市名 200 字与 IANA 校验；`reading-request.ts`：结构化问题字段同限额。
- `rotate-keys.ts`：导出真实操作用于 DB 测试，直接 CLI 才执行；`vitest.config.ts`：inline Auth.js 解决 Next 扩展名解析。
- `security-policy.ts`：保留 09 指定 next-intl 3.x 的适用性例外；Vitest 已升级，无该例外。

生产 HTTP 实测：`/zh` 返回 200、无凭据 cron 返回 401，两者包含所有安全头、强制基线 CSP 与不含 unsafe-eval 的脚本 Report-Only 策略。
如何验证：`pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`；另运行 `pnpm test:auth:e2e`、`pnpm audit`、`pnpm security:policy`、`pnpm licenses:check`。
结果：上述命令全部通过；61 个测试文件/1227 条测试、6 个认证 E2E；覆盖率 statements 99.55%、branches 98.75%、functions 100%、lines 99.82%。audit 退出 0，仍报告上述 4 条经验证例外，并非零 advisory。
未完成项/外部验证：生产 CSP 连续一周真实广告采样及其后完整脚本 enforce，真实 Google/Stripe/Sentry 账号端验收、生产数据库密钥实际轮换未执行；本次使用隔离数据库与签名事件测试，未触碰线上。
