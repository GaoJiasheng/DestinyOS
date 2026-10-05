# @tianji/engine

确定性的纯 TypeScript 排盘引擎。规范来源：`docs/04-engine-overview.md`、
`docs/systems/` 和 `docs/09-architecture.md` §2–§6。
无数据库、网络、隐式本地时区或系统时钟；可在浏览器运行。调用方提供时间和随机种子。

```ts
import { compute, normalizeBirth } from '@tianji/engine';

const birth = normalizeBirth(
  {
    calendar: 'gregorian',
    year: 1990,
    month: 5,
    day: 15,
    hour: 8,
    minute: 30,
    timeUnknown: false,
    gender: 'male',
    place: { name: 'Beijing', lat: 39.9, lng: 116.4, tz: 'Asia/Shanghai' },
  },
  'zh',
);
const result = compute({ system: 'bazi', birth, now: '2026-10-04T00:00:00Z' });
```

`ComputeInput` 由严格 Zod 请求 schema 推导；`compute` 同步返回 `EngineResult`，
包含 `system`、`engineVersion`、`computedAt`、`input`、`chart` 和 `meta`。
`meta.schoolUsed` 回显流派，`meta.warnings` 提供文案键。敏感输入由应用层加密保存。
`now` 必传，接受 ISO instant、`Temporal.Instant` 或 `Temporal.ZonedDateTime`。
塔罗必传 `seed`；每日运势必传 `birth` 和 `seed`；合盘需 `partnerBirth`。
体系枚举、字段、学校选项与 chart schema 以 shared 和对应体系文档为准。

## 公开入口审查

| package export                                  | 主要用途                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------- |
| `.`                                             | `compute`、`ComputeInput`、`ENGINE_VERSION`，以及体系/公共模块的现有导出  |
| `./common`                                      | `normalizeBirth`、`EngineError`、历法基础、真太阳时、干支关系、种子随机数 |
| `./version`                                     | 报告和缓存使用的 `ENGINE_VERSION`                                         |
| `./bazi`、`./ziwei`                             | `computeBazi`、`computeZiwei`，流派校验、图表 schema 和领域辅助函数       |
| `./iching`、`./qimen`、`./tarot`                | 起卦/抽牌输入 schema、`computeIching`、`computeQimen`、`computeTarot`     |
| `./astrology`、`./vedic`                        | 共用星历、角度/宫位/相位工具与 `computeAstrology`、`computeVedic`         |
| `./daily`、`./calendar`                         | `computeDaily`、日范围/评分/指标工具及年度日历事件                        |
| `./numerology`、`./rectification`、`./synastry` | 生命灵数、时辰反推和合盘的现有函数与类型                                  |

- 保留所有现有入口和导出名称；未缩减根入口，避免破坏 web、内容流水线与既有消费者。
- 根入口的 `detectPatterns` 是紫微版本；奇门版本为 `detectQimenPatterns`，
  `./qimen` 子入口仍导出自己的 `detectPatterns`。
- 根入口包含较多领域辅助函数。新消费者优先采用对应子入口，避免依赖内部 `src/` 路径。
- 参数角度以度计，经度东正西负、纬度北正南负；日期为 ISO 字符串，时区为显式 IANA 名称。
- 输入/流派错误使用 `EngineError(code, message, details)`。低层输出 schema 校验仍可抛
  Zod 错误；此次审查保留既有异常行为。展示层翻译错误码/警告键，不展示私密 details。
- 星历与流派版本、未知时辰降级、readonly 常量表的元素顺序均保持不变。

## 验证

从仓库根目录运行 `pnpm typecheck`、`pnpm test`、`pnpm engine:bundle`。
黄金用例和独立对照见 `test/fixtures/`、`test/xval/`；全仓覆盖率阈值为四项 ≥90%。
`engine:bundle` 验证浏览器 ESM 无外部运行时 import，并检查各体系 gzip 预算。
