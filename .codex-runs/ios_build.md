任务：iOS 正式构建与真实后端联调（上线前置）。
阅读：docs/app/00-app-plan.md（尤其 §0 决定、§5 账号与接口、§12 Apple 后台已配置的 ID）、docs/app/RELEASE.md、apps/mobile/README.md。
环境：Xcode 26.4.1；本机钥匙串有 "Apple Development: Gavin Gao" 证书；Team ID D33974QQTD；Bundle ID pub.gavin.tianji；App Group group.pub.gavin.tianji；线上后端 https://tianji.gavin.pub（合并后的新后端会在你完成后由 Owner 侧部署，联调时先用本地 `pnpm cf:smoke` 起的多 Worker 后端，再在 RELEASE.md 写明切换到生产 URL 的方式）。
要做：
1. 生产配置：app.config.ts 区分 development / production，生产 API_BASE_URL 指向 https://tianji.gavin.pub，关联域名 applinks:tianji.gavin.pub，App Group、Sign in with Apple、推送权限与 §12 一致；版本号 1.0.0、build 号 1；去掉一切调试入口与测试广告单元（无真实 AdMob ID 时广告位隐藏而不是展示测试广告）；RevenueCat/AdMob 公钥缺失时购买入口显示「即将开放」而不是崩溃。
2. 本地构建：`npx expo prebuild --platform ios --clean`；主 App 与小组件扩展（Widget Extension）都使用自动签名、Team D33974QQTD；扩展的 Bundle ID 采用 pub.gavin.tianji.widgets（或现有命名），用 `xcodebuild -allowProvisioningUpdates` 让 Xcode 自动在开发者账号下注册扩展 App ID 并加入同一 App Group。构建 Release 版到 iOS 模拟器并安装运行。
3. 归档：`xcodebuild archive -allowProvisioningUpdates -configuration Release` 生成 .xcarchive，再用 `-exportArchive` + ExportOptions.plist（method app-store-connect，signingStyle automatic，teamID D33974QQTD，uploadSymbols true）导出 .ipa 到 apps/mobile/release/。**不要上传**。若因缺少 Apple Distribution 证书或 Xcode 未登录开发者账号而失败，停在这一步，把准确的错误与 Owner 需要做的操作（例如在 Xcode › Settings › Accounts 登录、或允许生成分发证书）写进 docs/progress/IOS-BUILD.md，然后继续完成其余步骤。
4. 真实后端联调：在模拟器的 Release 构建上用 Maestro 跑主流程——匿名出生档案 → 七体系报告离线计算 → 今日运势 → 塔罗仪式 → 摇卦 → 登录（Google 或邮箱魔法链接用测试替身）→ 同步 → 追问大师（离线时禁用提示）→ 导出与分享 → 内购页（沙盒/禁用态）→ 删除账号；截图存 apps/mobile/test-results/ios-build/。修复发现的所有问题。
5. 包体与性能：记录 .ipa 体积、冷启动时间、首屏帧率；超过 150MB 或冷启动 > 2s 则优化。
6. 写 docs/progress/IOS-BUILD.md（每一步命令、结果、遗留项）并更新 docs/app/RELEASE.md；提交。不 push、不上传。
