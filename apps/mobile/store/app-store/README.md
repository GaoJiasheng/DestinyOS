# iOS 商店资料 · IOS-STORE

主语言 **en-US**。简中 **zh-Hans** 映射 App/Web 的 `zh`；繁中 **zh-Hant** 映射 `zh-TW`。首版 1.0.0。仅本地文件，不登录后台、不上传、不更改签名和服务配置。

## 可填写文件

- `metadata/{en-US,zh-Hans,zh-Hant}.md`：可粘贴的名称、副标题、宣传文本、描述、关键词、新功能、三个 URL；每项标注字符数。中文名称各三个候选，第一项首选。
- 同名 JSON：value、characters、limit，供自动校验。英文名固定为 `DestinyOS: BaZi & Tarot`。关键词不重复名称中的词。
- `copy/*.json`：独立 next-intl 源词库，三语齐全，不改 App/Web 词库；`app-store-assets.mts` 统一渲染导出。
- `privacy-answers.md`：问卷顺序、逐类型答案、本次 Release 与配置服务后的差别、代码证据、政策/清单差异。
- `review-notes.md`：英文可粘贴备注、私密演示账号填写说明、产品 ID、AI 边界、免责、4.3 差异化、18+。
- `submission-status.json`：机器可读的未完成门槛。**文件与截图已校验不等于可以提交审核**。

## 手机截图

`screenshots/{locale}/6.9/` 为 1320×2868；`6.5/` 为本任务指定的 **1284×2778**，每种语言每种尺寸 6 张。分别从 iPhone 16 Pro Max 和 iPhone 14 Plus 专用模拟器的 production **Release** 包采集。后者不是旧 M15 的 1242×2688。

依次为今日真实星空、八字命盘、西方本命盘、塔罗学习牌义、月历、体系入口。英文素材完全使用英文界面；简中/繁中使用对应界面。金色天象网格只装饰外围，界面整屏等比缩放，无裁剪、修图、模拟产品 UI 或测试横幅。

`apps/mobile/test-results/IOS-STORE/raw/` 保存原图；`build.json` 记录构建类型、二进制与 Hermes bundle 哈希、设备型号；`screenshots.json` 关联每张原图与最终文件哈希。模拟成年档案通过正式引导/表单录入，使用虚构昵称 Alex，不使用 Fixture A 或 `/dev/*`。

## 本地重现

```bash
pnpm install
bash apps/mobile/scripts/ios-release.sh simulator <UDID>
# 仅针对已安装上述 Release 的专用模拟器；prepare 会清空其 App/Keychain 测试状态
bash apps/mobile/scripts/app-store-capture.sh <UDID-6.9> 6.9 prepare
bash apps/mobile/scripts/app-store-capture.sh <UDID-6.9> 6.9 capture
bash apps/mobile/scripts/app-store-capture.sh <UDID-6.5> 6.5 prepare
bash apps/mobile/scripts/app-store-capture.sh <UDID-6.5> 6.5 capture
# capture 自动遍历 en / zh / zh-TW 并归档 raw；today 模式可单独补拍首屏
pnpm --filter @tianji/mobile exec tsx scripts/app-store-assets.mts --metadata-only
pnpm --filter @tianji/mobile exec tsx scripts/app-store-assets.mts
pnpm exec tsx scripts/store-check.ts --assets-only
pnpm exec tsx scripts/store-check.ts
```

Maestro 使用本机既有 JVM；没有安装 Java、Android SDK 或进行 Android 原生构建。正式提审前须补真实已登录内购页和 StoreKit 购买确认态；购买配置缺失时无法采集，诊断截图只保留在 test-results，不当作审核素材。完整 `store-check.ts` 默认会拒绝缺少这两张图或存在提交门槛的资料包；`--assets-only` 仅验已交付的三语文案和 36 张手机图。

URL 是仓库现有路由，`url-checks.json` 记录本次 HTTP 实测；隐私页仍需覆盖 App 数据流。本任务只在 `docs/progress/IOS-STORE.md` 写要求的进度，不修改其他 docs 或网页政策。iPad、Android 原生/模拟器、TestFlight、真实沙盒、最终签名 Archive 与 Owner 私密审核信息待验。
