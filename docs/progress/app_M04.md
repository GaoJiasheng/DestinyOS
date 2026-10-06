# App M04：加密本地数据层

## 完成项
- expo-sqlite 开启 SQLCipher（iOS/Android）；256 位设备主密钥仅存在 expo-secure-store。
- 首次解锁在所有读写之前完成；SQLCipher 缺失、密钥丢失/损坏、库损坏均停止打开，不覆盖旧数据。
- 串行数据库连接、原子事务、user_version 两阶段迁移；拒绝未知未来 schema。
- 多档案及版本历史、报告输入/排盘/双语报告快照、日记、设置的严格模型和 CRUD。
- 匿名作用域离线可用；账号隔离、updatedAt 后写覆盖、服务器同时间优先、增量导出及删除墓碑。
- 档案删除原子清除历史版本和关联报告/日记内容，取消当前档案选择；支持设备个人数据清空。
- 日记每档案每日一条，修改保留首次预测；设置并发补丁保留其他字段。
- 主题/语言改用加密设置；一次性迁移旧 AsyncStorage 偏好，成功写入后才移除旧副本。
- 复用 packages/content 编译内容，随包覆盖十体系及 common，中英知识单元同时存在。
- 知识库客户端：knowledgeVersion、gzip 增量、Ed25519 验签、SHA-256、大小/schema 校验、拒绝回退。
- 验签及合并成功后以事务 compare-and-swap 替换；失败、断网或并发冲突保留原离线知识库。
- Jest 真实 SQLite 测试；开发验收页使用共享 next-intl 文案，生产版本跳转离开该页。
- SQLCipher BSD-3-Clause 声明保留；未新增 GPL/AGPL 依赖，未提交任何生产密钥。

## 未完成项 / 待验项
- M04 范围内无未完成项；M09 提供生产签名公钥与服务端 manifest/bundle 接口后做联调。
- 登录后的确认导入、网络同步及账号删除界面归 M10；本层不会上传匿名数据。
- Android 原生构建、Keystore/SQLCipher 设备验收及模拟器截图等待 Owner 安装 Java；本次未安装 Java。
- M05 补存储恢复界面；当前加密库失败仍拒绝落入明文存储。

## DESIGN-GAP
- SQLCipher 全页加密，设备 JSON 使用解密后的领域字段；encBirth/encInput 前缀保留为服务器字段加密语义。
- 保留完整加密 engine/report JSON 快照供离线复现；共享 schema 校验请求输入。
- 档案年龄门槛沿用 Web：归一化公历生日、UTC 日期，13 岁以下不落库。
- 日记沿用 Web：明确 IANA 时区、允许过去日期，拒绝未来日期。
- 原生推送/小组件/触感设置字段集中定义，默认推送开启、08:00、音效关闭。
- iOS 密钥采用 AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY，允许首次解锁后的后台计算，禁止跨设备迁移/生物识别要求。
- Expo 独占事务会另开未设密钥连接；改用同一已设密钥连接排队执行 BEGIN IMMEDIATE，包括读取。
- 旧主题/语言仅一次性迁移，写入加密设置成功后删除旧副本。
- M09 增量线格式为 gzip JSON：upsert/remove 和可选 glossary/transitions 替换；签名 manifest 绑定版本/基线/哈希/大小。
- Ed25519 信任锚由构建提供，不信任下载的公钥；缺生产公钥时更新失败关闭，内置知识库照常可用。
- 公共更新请求设 15 秒超时、拒绝重定向，只发送 knowledgeVersion。
- 启动后预热离线数据/内容；M05 承接本地存储错误恢复界面。

## 如何验证
- 实际执行并通过：pnpm install、pnpm lint、pnpm typecheck、pnpm test、pnpm build。
- Vitest：128 文件 / 3697 项通过，保留既有 1 文件 / 2 测试跳过；语句 99.54%、分支 98.77%。
- App Jest/RNTL：7 套件 / 58 项通过，含迁移、事务回滚、隔离、级联墓碑、并发写入、知识包失败保持旧版。
- pnpm licenses:check 通过，共 1700 个包；Web 共享包未修改，完整 Web 单测及生产构建通过。
- Android：expo prebuild --platform android --no-install 通过，gradle.properties 含 expo.sqlite.useSQLCipher=true。
- iOS：expo prebuild 与 expo run:ios --device E35A99F1-F6C1-4BF8-8EED-018CDDB93917 --no-bundler 通过。
- bash apps/mobile/scripts/m04-simulator.sh：Maestro 通过，Hermes 上 SQLCipher 4.7.0、文件无明文、错误密钥拒绝、重开持久化、删除均通过。
- apps/mobile/test-results/M04/ 保存 storage-passed.png 与 M04-storage.json；验收临时数据库与 SecureStore 密钥均已清理。
