任务：AI 追问大师（docs/14-backlog.md B-05），后端用 MiniMax，Owner 已提供包年额度。
密钥：apps/web/.env.local 已有 MINIMAX_API_KEY 与 MINIMAX_BASE_URL（国际站 https://api.minimax.io/v1；若 401/404 则尝试 https://api.minimaxi.com/v1，并把可用值写回 .env.local 与 .env.example 注释，绝不把 key 写进代码、日志、文档或 git）。
要做：
1. 先用 curl 调 models 接口确认可用模型列表，选性价比最高、支持中英文、上下文 ≥ 64k 的文本模型作为默认（如 MiniMax-M2 系列中最便宜的），模型名放 env `MINIMAX_MODEL`；实现 OpenAI 兼容的流式调用封装 apps/web/lib/llm/minimax.ts，带超时、重试一次、用量日志（只记 token 数）。
2. 隐私边界（必须）：发给模型的上下文只包含去标识化内容：体系、chart 中的派生要素（四柱/星曜/行星位置等）、已生成报告的章节文本、用户问题；不包含姓名、出生日期时间、出生地名、邮箱。提示词在 apps/web/lib/llm/prompts/*.md，系统提示要求：以温和笃定的命理师口吻、只基于给定命盘与报告作答、不预测生死疾病、不给医疗法律投资建议、承认不确定、每次回答 ≤ 300 字/200 词、zh/en 随用户语言。
3. 产品：报告页底部「追问大师」面板（可折叠）与 /[locale]/[system]/r/[id]/chat 全屏页：流式输出、建议问题 chips（按体系预置 6 条）、会话按 reading 保存（新表 ChatMessage：readingId、role、content 加密、tokens、createdAt），历史可删。配额：免费 3 次/天、会员 30 次/天（SiteConfig 可改），超限提示；匿名用户不可用（引导登录）。限流与审计。
4. 失败降级：模型不可用时面板显示「大师暂时离开」，不影响报告。
5. 测试：封装层用 mock；一条真实冒烟测试（跳过若无 key）；隐私单测断言发出的 payload 不含生日/姓名/地名；E2E 面板交互。
