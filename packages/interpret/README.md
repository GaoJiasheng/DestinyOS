# @tianji/interpret

基于已发布知识单元的确定性解读组合引擎。规范来源：
`docs/05-interpretation-engine.md` 和 `docs/09-architecture.md` §2、§3.3。
只处理调用方传入的 chart 和内存知识库；不读数据库、不请求网络、不调用运行时 LLM。

```ts
import { interpret } from '@tianji/interpret';
import type { InterpretInput } from '@tianji/interpret';

export function makeReport(input: InterpretInput) {
  return interpret(input);
}
```

`InterpretInput` 必含 `system`、`chart`、`locale`、`knowledge` 和 `context`。
`knowledge` 是 `@tianji/content` 的 `KnowledgeBundle`；应用层负责加载和缓存。
`context.now` 为显式时间，`profileHasTime` 表示出生时辰是否已知；可选
`engineVersion` 回写报告版本，`userId` 用于稳定选择内容变体。
支持 `zh`、`en` 与现有 `zh-TW`；繁体复用中文报告再本地化，英文独立组文。

`Report` 保留版本信息、headline、sections、hits、doDont、readability、disclaimerKey。
正文中的 `[[term:key]]` 是术语标记；evidence、免责声明和可读性 issue 使用展示层文案键。
`readability.passed` 与 `issues` 是诊断结果，调用方需自行处理不达标状态。

## 公开入口审查

包仅公开 `.`，目前导出以下 API；此次审查未删除或更名任何既有导出。

| 导出                                            | 合约                                                                                                               |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `interpret`、`interpretVersion`                 | 同步组文与解读版本；相同输入和知识版本生成相同结果                                                                 |
| `systemConfigs`、`numeric`                      | 体系章节计划/扩展 hooks；读取首个有限数值或回退值                                                                  |
| `hash`                                          | 固定的 32 位无符号散列，用于过渡和变体选择                                                                         |
| `checkReadability`                              | 检查篇幅、术语密度与未替换变量，返回稳定 issue 键                                                                  |
| `termPattern`、`termMarker`                     | 术语匹配规则与每份报告首次出现的标记器                                                                             |
| `expandTerms`、`termCount`、`createTermCounter` | 术语展开/计数；编译计数器可在同一份报告复用                                                                        |
| `localizeReport`                                | 现有报告的语言文字本地化                                                                                           |
| 类型导出                                        | `Score`、`ReportBlock`、`Section`、`Hit`、`Report`、`SectionSpec`、`SectionPlan`、`SystemConfig`、`InterpretInput` |

- `sectionPlan` 和 `config` 是显式扩展点；配置合并、权重和冲突排序未变。
- `termMarker` 自带一次报告内的已见词状态，每份报告须创建新标记器。
- `systemConfigs` 和低层 helpers 保持兼容；新增消费者优先使用 `interpret` 与公开类型。
- 不合法章节计划或缺少已发布 `common.disclaimer` 会抛普通 `Error`；
  保留此异常合约，web 边界统一映射为 `E_INTERNAL`，不将 exception details 返回用户。
- 不允许依赖 web、Prisma 或 Node 专有模块；依赖方向为 shared/engine/content → interpret。

## 验证

从仓库根目录运行 `pnpm content:validate`、`pnpm typecheck`、`pnpm test`。
`test/` 覆盖双语篇幅、章节、互斥/让步、变量替换、术语匹配与确定性组文。
仓库现有覆盖率收集 engine/shared/crypto；解读行为通过完整测试断言验证。
