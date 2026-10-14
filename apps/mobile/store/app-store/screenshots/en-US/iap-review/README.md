# 首版不提交内购

`EXPO_PUBLIC_FEATURE_MEMBERSHIP` 默认关闭。首版不提供 App 内购买，也不提交内购商品或内购审核截图；`store-check` 在关闭状态不要求本目录的图片。

将来明确开启会员后，须配置真实产品与公开 SDK key，并采集真实 Release 沙盒会员页及购买确认截图。现有产品 ID 保持 `tianji_pro_monthly`、`tianji_pro_lifetime`；诊断或 mock 截图不能作为审核图。审核账号、密钥及签名资料不写入仓库。
