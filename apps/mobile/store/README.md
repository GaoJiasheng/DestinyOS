# M15 商店素材

需求与 Owner 操作步骤见 [RELEASE.md](../../../docs/app/RELEASE.md)。素材源文案在共享 next-intl 词库，修改后执行 `pnpm --filter @tianji/mobile store:metadata`；原始截图、来源哈希与尺寸在 `../test-results/M15/`。

| 素材                                        | 上传位置                                         |
| ------------------------------------------- | ------------------------------------------------ |
| `metadata/en.json`、`zh.json`、`zh-TW.json` | 两家商店对应本地化；Play 无副标题/关键词独立字段 |
| `screenshots/iphone-6.9/{locale}/01..06`    | Apple 6.9 寸槽位，1320×2868 PNG                  |
| `screenshots/iphone-6.5/{locale}/01..06`    | Apple 6.5 寸槽位，1242×2688 PNG                  |
| `feature-graphic.png`                       | Google Play feature graphic，1024×500            |
| `../assets/icon.png`、`play-icon.png`       | Apple 1024×1024；Play 512×512                    |
| `PRIVACY.md`                                | Apple 隐私营养标签 / Google Data safety 草稿     |

`pnpm --filter @tianji/mobile store:assets` 会以 token 星空、金色框与三语标题装饰真实截图，整屏等比例放入模板，不裁切界面、不合成产品功能。相同尺寸必须来源于对应 iPhone 模拟器。模板/图标由 sharp 绘制，使用已有 Apache-2.0 依赖，不添加图片素材授权风险。

Android 手机截图待 Owner 安装 Java 与 Android 模拟器后采集；目前包内不存在伪 Android 截图。`store:assets` 检测到 Android 原图后会生成 1080×1920 的对应品牌图。iPad、内购审核截图与可选预览视频按 RELEASE 手册补齐。
