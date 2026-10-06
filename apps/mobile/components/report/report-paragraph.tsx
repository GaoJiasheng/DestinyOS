import { useState } from 'react';
import { Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import type { GlossaryEntry } from '@tianji/content';
import { localeText, sourceLocale } from '@tianji/shared/locale';
import { useCopy } from '../../lib/copy';
import { usePreferences } from '../../lib/preferences';
import { useTheme } from '../../lib/theme';
import { ReportSheet } from './report-ui';
import { CopyText } from '../native-ui';

/** Inline term annotations open bilingual native sheets; long press copies readable paragraph text. */
export function ReportParagraph({
  text,
  glossary,
  id,
}: {
  text: string;
  glossary: readonly GlossaryEntry[];
  id?: string;
}) {
  const t = useCopy(),
    { colors, body } = useTheme(),
    locale = usePreferences((s) => s.locale);
  const [term, setTerm] = useState<GlossaryEntry | null>(null),
    [copied, setCopied] = useState(false);
  const parts = text.split(/(\[\[term:[^\]]+\]\])/);
  const entryFor = (part: string) =>
    glossary.find((entry) => entry.key === /^\[\[term:([^\]]+)\]\]$/.exec(part)?.[1]);
  const plain = parts
    .map((part) => {
      const entry = entryFor(part);
      return entry ? localeText(entry[sourceLocale(locale)].term, locale) : part;
    })
    .join('');
  async function copy() {
    try {
      await Clipboard.setStringAsync(plain);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }
  return (
    <>
      <Text
        testID={id}
        onLongPress={() => void copy()}
        accessibilityHint={t('mobile.report.copyHint')}
        style={{ color: colors['text-2'], fontFamily: body, fontSize: 17, lineHeight: 29 }}
      >
        {parts.map((part, i) => {
          const entry = entryFor(part);
          return entry ? (
            <Text
              key={i}
              testID={`term-${entry.key}`}
              accessibilityRole="button"
              accessibilityLabel={t('report.content', {
                text: localeText(entry[sourceLocale(locale)].term, locale),
              })}
              onPress={() => setTerm(entry)}
              style={{
                color: colors.gold,
                textDecorationLine: 'underline',
                textDecorationStyle: 'dotted',
              }}
            >
              {t('report.content', { text: localeText(entry[sourceLocale(locale)].term, locale) })}
            </Text>
          ) : (
            t('report.content', { text: part })
          );
        })}
      </Text>
      {copied ? <CopyText testID="paragraph-copied">{t('mobile.report.copied')}</CopyText> : null}
      {term ? (
        <ReportSheet
          id="term-detail"
          title={t('report.content', { text: `${term.zh.term} · ${term.en.term}` })}
          close={() => setTerm(null)}
        >
          {term.zh.pinyin ? (
            <CopyText>{t('report.content', { text: term.zh.pinyin })}</CopyText>
          ) : null}
          <CopyText>
            {t('report.content', { text: localeText(term[sourceLocale(locale)].short, locale) })}
          </CopyText>
          <CopyText>
            {t('report.content', { text: localeText(term[sourceLocale(locale)].long, locale) })}
          </CopyText>
        </ReportSheet>
      ) : null}
    </>
  );
}
