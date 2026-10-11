# 内购审核截图待采集

应补 `01-membership.png`（真实已登录会员页，商品、当地价格与恢复入口可见）和 `02-purchase-confirmation.png`（实际 StoreKit 沙盒购买确认态），均为 1290 像素宽、不透明 PNG，等比保留界面。

本次 production Release 未配置 RevenueCat，不能展示可购买商品或真实购买确认态；也没有真实审核登录。`test-results/IOS-STORE/raw/*/*/membership-unconfigured.png` 是不可购买状态的诊断证据，不能上传作为审核图。旧 M13 mock 购买/恢复截图同样不适用。本目录没有生成占位 PNG。

Owner 提供正式公开 SDK key、已连接产品与测试登录后，在 Release 沙盒/真机中采集；不将密钥、账号或签名资料写入仓库。两项 IAP 仍使用 `tianji_pro_monthly`、`tianji_pro_lifetime`，首版与 App 一同送审。完整 `scripts/store-check.ts` 会在这些图片缺失时失败。
