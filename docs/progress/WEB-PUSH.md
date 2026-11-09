# WEB-PUSH（B-04 网页端每日运势提醒）

状态：**已实现，默认关闭**。线上未开启，需要 Owner 完成文末上线步骤。邮件日报/周报不在范围内。

## 架构

- 主入口 `destinyos`：只在 `lib/platform/scheduled.ts` 多一条分支。每小时 cron 且 `FEATURE_WEB_PUSH=true`
  时，在 cost-circuit 之后带 `CRON_SECRET` 请求 `/api/v1/cron/web-push`，两者失败互不影响。无 Prisma、无新依赖。
- 发送和订阅都在 `destinyos-compute`：`app/api/v1/cron/web-push/route.ts`、`lib/web-push-service.ts`、
  `app/me/push-actions.ts`（server action，沿用 Next 来源检查 + `auth()` + `ratelimit('push')` 每小时 30 次）。
- 协议 `lib/web-push.ts`（VAPID ES256、RFC 8291 aes128gcm，纯 WebCrypto）；到点规则与上限 `lib/web-push-schedule.ts`。
- 开关 `lib/web-push-flag.ts`：`FEATURE_WEB_PUSH` 与 `NEXT_PUBLIC_FEATURE_WEB_PUSH` 都为 true 才算开启（同会员开关）。
  关闭时：设置页不显示、cron 返回 `disabled`、三个 action 返回 `E_FEATURE_DISABLED`。
- 前端 `components/me/push-reminder-settings.tsx`：只在用户点开关时 `requestPermission`。
- `public/sw.js`：文件末尾追加 `push` / `notificationclick`，install/activate/fetch 未改。`CACHE` 版本由
  `pwa-assets.ts` 按离线壳/字体/图标内容生成，不含 sw.js 自身，**本次无需重新生成**。

## 数据模型

`PushSubscription`（迁移 `0008_push_subscription.sql`）：`endpointHash`（SHA-256，唯一）、`encEndpoint`、`encKeys`
（AES-256-GCM 按用户子密钥）、`locale`、`tz`、`hour`（6/7/8/9/12/20，默认 8）、`lastSentDate`（幂等键）、
`failureCount`、`disabledAt`。一账户最多 10 台设备，超出删最旧。同一浏览器换账号登录时行转给新账号并用新账号密钥重加密。

## 发送流程与上限

1. 鉴权 → 开关 → VAPID 配置 → 熔断（`circuitOpen`，开路返回 `circuit_open`）→ `stateReserve` 锁（300 秒）。
2. 取活跃订阅的 distinct `tz`，用 `reminderDue` 算出每个时区此刻到点的整点，按（本地日期 + 到点整点）分组，SQL 过滤。
3. 每批 20 条：条件 UPDATE 抢占 `lastSentDate ... RETURNING id`，**只发抢到的**；并发发送，单条 5 秒超时。
4. 结果原子落库：404/410 删行；成功且曾失败则清零；其他失败 `failureCount+1`，满 5 次写 `disabledAt`。
5. 每轮最多 400 条 / 20 秒，超出留给下一轮。到点窗口含 2 小时补发（`PUSH_CATCHUP_HOURS`），超出窗口当天不再补发。
6. 整点已过才开启或改时间的，当天不发，避免补发窗口造成晚到提醒；同一天改时间不会重复发。

语义是**至多一次**：抢占后发送失败或 Worker 中断，当天不重发，第二天继续。

## 隐私处理

- 推送内容只有通用文案（`push.reminder.*`，三语唯一定义处是 messages）和 `/{locale}/today`，无命理或个人信息。
- 端点与密钥仅密文落库，已加入 `rotate-keys`；账户数据导出只含 locale/tz/hour/lastSentDate/disabledAt/createdAt。
- 账户软删除时删行，硬删除由外键级联。隐私政策新增“网页推送提醒”一节，三语（更新日期已改）。
- 被停用的行保留到用户重新开启或删号，目前没有定期清理。

## 上线步骤（Owner）

1. `pnpm exec tsx scripts/vapid-keys.ts` 生成密钥对（只输出到终端）。
2. 构建变量：`NEXT_PUBLIC_VAPID_PUBLIC_KEY=<公钥>`、`NEXT_PUBLIC_FEATURE_WEB_PUSH=true`。
3. `wrangler secret put VAPID_PRIVATE_KEY --config wrangler.compute.toml`。
4. `wrangler.compute.toml` 填 `VAPID_SUBJECT`（如 `mailto:privacy@gavin.pub`）。
5. 线上 D1 应用迁移 0008（现有发布流程）。
6. 两个 toml 的 `FEATURE_WEB_PUSH` 改为 `"true"`（主入口也要，否则不触发），重新构建部署。
7. 真机验收：Chrome/Android 与 iOS 主屏 PWA 各开启一次，确认收到并能点开 `/{locale}/today`。

回滚：把 `FEATURE_WEB_PUSH` 改回 false 即停发，无需回滚迁移。

## 未完成项 / 已知限制

- 未在真实推送服务（FCM/Mozilla/APNs）与线上 workerd 验证；sw 的真实系统点击无法自动化，点击逻辑是调用真实监听器 + 模拟 clients 验证的。
- 时区和语言在开启或改时间时记录，换时区后需回设置页改一次时间才更新。
- 超量时不按迟到程度排序；单轮 CPU 未在 workerd 实测（`cpu_ms=5000`）。
- 邮件日报/周报未做。
