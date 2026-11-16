任务：首版关闭会员与付费（Owner 决定：先不接付费、不接广告，把基础功能做好）。
要做：
1. 新增总开关 FEATURE_MEMBERSHIP（Web 服务端与构建期公开变量、App 的 EXPO_PUBLIC_FEATURE_MEMBERSHIP），默认 false。关闭时：
   - Web：隐藏导航/页脚/设置/报告页/导出面板里所有会员、定价、去广告、「在 App 中开通」入口；/pricing 与 /me/billing 返回 404（或重定向到首页）；权益判断一律按免费用户但不展示任何付费提示；与会员挂钩的限制（历史 50 条、分享模板、PDF 导出等）首版对所有登录用户放开为会员级别，避免出现「需要会员」的死胡同。
   - App：隐藏会员 Tab/入口、购买与恢复购买按钮、「即将开放」文案；RevenueCat SDK 不初始化、不打包原生模块（与现有 AdMob 缺省处理方式一致）；同样放开原会员限制。
   - 广告：Web 与 App 在未配置真实 ID 时已不展示，确认首版完全无广告位占位。
2. 文案、i18n（zh/zh-TW/en）同步删除不再出现的入口文案引用，i18n:check 通过。
3. 商店资料：更新 apps/mobile/store/app-store/ 的描述、审核备注（说明首版无 App 内购买、无广告）、隐私问卷答案（去掉 RevenueCat/AdMob/ATT 相关项，以实际打包的 SDK 为准）；若商店截图里出现会员相关界面则重拍；store-check 去掉 IAP 截图硬性要求（会员开关关闭时）。
4. 隐私政策中 App 内购买与广告相关表述改为「目前不提供，将来提供时会更新本政策」。
5. 全部检查：lint、typecheck、Web 与 App 全量单测、e2e 主流程与 polish、cf:build、cf:multi:smoke、iOS Release 模拟器构建 + Maestro 主流程；提交，不部署、不 push。写 docs/progress/NO-MEMBERSHIP.md。
