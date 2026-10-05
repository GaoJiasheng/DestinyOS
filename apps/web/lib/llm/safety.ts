import { createTranslator } from 'next-intl';
import zh from '../../messages/zh.json';
import en from '../../messages/en.json';
import zhTw from '../../messages/zh-TW.json';
import { toMessages, type MessageKey } from '../../i18n/catalog';
export type RefusalReason = 'abuse' | 'override' | 'privacy' | 'medical' | 'investment';
// DESIGN-GAP: Explicit unsafe requests are refused locally before inference; normalization covers zero-width/full-width disguises. This is defense in depth alongside the system prompt, not a universal injection detector.
const rules: readonly [RefusalReason, RegExp][] = [
  [
    'privacy',
    /(?:反推|套取|还原|泄露|索要|询问|提供|告诉|输出).{0,35}(?:生日|出生|姓名)|(?:生日|出生日期|出生时间|出生地).{0,25}(?:反推|索要|告诉)|(?:reverse.?engineer|reconstruct|reveal|extract|infer|ask for|request|print|give me).{0,65}(?:birth(?:day|place| date| time)?|name|personal (?:data|information))/i,
  ],
  [
    'override',
    /忽略.{0,20}(?:指令|限制|规则)|系统(?:消息|提示词)|隐藏(?:提示词|指令)|解除限制|管理员|别人的报告|私密对话|(?:ignore|override|bypass|remove).{0,35}(?:instructions|rules|restrictions|limits)|(?:system|hidden).{0,15}(?:prompt|message|instructions)|administrator|another user.{0,20}(?:report|chat)|private chats/i,
  ],
  [
    'abuse',
    /辱骂|恶毒|废物|活该|人身攻击|(?:insult|abusive|idiot|moron|deserve(?:s)? misfortune|fuck you|shut up)/i,
  ],
  [
    'medical',
    /诊断|吃什么药|预测.{0,15}(?:疾病|病|寿命|死亡)|会得什么病|(?:diagnose|which medication|what (?:drug|medicine)|predict.{0,20}(?:death|lifespan)|disease I will get)/i,
  ],
  [
    'investment',
    /(?:买|推荐|投资).{0,15}(?:哪只股票|哪支股票|标的)|保证收益|稳赚|(?:which stock|buy.{0,20}stock|guarantee.{0,15}returns|investment recommendation)/i,
  ],
];
const catalogs = { zh, en, 'zh-TW': zhTw };
// DESIGN-GAP: Server-side safety copy uses the same next-intl catalog as the chat panel.
/** Translate chat guard/recovery copy in the requested locale. */
export function chatCopy(key: MessageKey, locale: 'zh' | 'en' | 'zh-TW'): string {
  const t = createTranslator({ locale, messages: toMessages(catalogs[locale]) });
  return t(key);
}
/** Return localized refusals for explicit boundary violations; ordinary wellbeing/money reflections remain allowed. */
export function chatRefusal(
  question: string,
  locale: 'zh' | 'en' | 'zh-TW',
): { reason: RefusalReason; content: string } | null {
  const normalized = question
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '');
  const reason = rules.find(([, pattern]) => pattern.test(normalized))?.[0];
  if (!reason) return null;
  return { reason, content: chatCopy(`report.chat.refusal.${reason}`, locale) };
}
