import type { AbstractIntlMessages } from 'next-intl';
/** Interactive features need term explanations, never encyclopedia-length glossary prose. */
export function featureMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const glossary = messages.glossary;
  return {
    ...messages,
    glossary:
      glossary && typeof glossary === 'object'
        ? Object.fromEntries(
            Object.entries(glossary).map(([key, value]) => [
              key,
              value && typeof value === 'object'
                ? Object.fromEntries(Object.entries(value).filter(([field]) => field !== 'long'))
                : value,
            ]),
          )
        : {},
  };
}
/** A daily view uses only its own labels and glossary terms; inherited shell text stays in the root provider. */
export function dailyMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const namespaces = new Set([
    'home',
    'common',
    'daily',
    'charts',
    'journal',
    'share',
    'calendar',
    'errors',
    'engine',
    'art',
  ]);
  const selected = Object.fromEntries(
    Object.entries(messages).filter(([key]) => namespaces.has(key)),
  );
  const glossary = messages.glossary;
  selected.glossary =
    glossary && typeof glossary === 'object'
      ? Object.fromEntries(
          Object.entries(glossary).map(([key, value]) => [
            key,
            value && typeof value === 'object' ? pick(value, ['term']) : value,
          ]),
        )
      : {};
  for (const key of ['nav', 'report', 'bazi', 'tarot']) {
    const value = messages[key];
    if (!value || typeof value !== 'object') continue;
    selected[key] =
      key === 'report'
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([name]) =>
                [
                  'content',
                  'error',
                  'disclaimer',
                  'feedback',
                  'section',
                  'share',
                  'ad',
                  'loading',
                ].includes(name),
              )
              .concat([
                [
                  'sections',
                  typeof value.sections === 'object' ? pick(value.sections, ['daily']) : {},
                ],
              ]),
          )
        : key === 'bazi'
          ? pick(value, ['stems', 'branches'])
          : key === 'nav'
            ? pick(value, ['today'])
            : pick(value, ['upright', 'reversed']);
  }
  const me = messages.me;
  if (me && typeof me === 'object') selected.me = pick(me, ['journal']);
  return selected;
}

function pick(messages: AbstractIntlMessages, keys: string[]): AbstractIntlMessages {
  return Object.fromEntries(Object.entries(messages).filter(([key]) => keys.includes(key)));
}
