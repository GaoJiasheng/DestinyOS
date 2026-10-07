import { useState } from 'react';
import { View, Pressable } from 'react-native';
import type { Section } from '@tianji/interpret';
import type { GlossaryEntry } from '@tianji/content';
import { useCopy } from '../../lib/copy';
import { useTheme } from '../../lib/theme';
import { ReportCard } from './report-ui';
import { ReportParagraph } from './report-paragraph';
import { CopyText, Action } from '../native-ui';
/** Native collapsible chapter renders every interpretation block and durable feedback. */
export function ReportSection({
  section,
  open,
  toggle,
  glossary,
  onEvidence,
  vote,
  onVote,
}: {
  section: Section;
  open: boolean;
  toggle: () => void;
  glossary: readonly GlossaryEntry[];
  onEvidence: (path: string) => void;
  vote?: boolean;
  onVote: (value: boolean) => Promise<void>;
}) {
  const t = useCopy(),
    { colors } = useTheme();
  const [sources, setSources] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  async function feedback(value: boolean) {
    setBusy(true);
    setError(false);
    try {
      await onVote(value);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <ReportCard id={`section-${section.key}`}>
      <Pressable
        testID={`section-toggle-${section.key}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={toggle}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <CopyText title>{t('report.content', { text: section.title })}</CopyText>
      </Pressable>
      {open ? (
        <>
          <ReportParagraph text={section.lead} glossary={glossary} />
          {section.blocks.map((block, i) => {
            switch (block.type) {
              case 'paragraph':
              case 'transition':
                return (
                  <ReportParagraph
                    key={i}
                    id={`paragraph-${section.key}-${i}`}
                    text={block.text}
                    glossary={glossary}
                  />
                );
              case 'evidence':
                return (
                  <View key={i} style={{ gap: 8 }}>
                    <CopyText>{t('report.evidence')}</CopyText>
                    {block.items.map((item, j) => (
                      <Action
                        key={`${item.path}-${j}`}
                        id={`evidence-${section.key}-${j}`}
                        label={t('report.content', { text: item.label })}
                        onPress={() => onEvidence(item.path)}
                      />
                    ))}
                  </View>
                );
              case 'advice':
                return (
                  <View key={i} style={{ gap: 8 }}>
                    <CopyText title>{t('report.advice')}</CopyText>
                    {block.items.map((item, j) => (
                      <ReportParagraph key={j} text={item} glossary={glossary} />
                    ))}
                  </View>
                );
              case 'sources':
                return (
                  <View key={i} style={{ gap: 8 }}>
                    <Action
                      id={`sources-${section.key}`}
                      label={t('report.sources')}
                      onPress={() => setSources((v) => !v)}
                    />
                    {sources
                      ? block.items.map((item, j) => (
                          <View key={j}>
                            <CopyText>{t('report.content', { text: item.text })}</CopyText>
                            <CopyText>{t('report.content', { text: item.from })}</CopyText>
                          </View>
                        ))
                      : null}
                  </View>
                );
              case 'chart_ref':
                return (
                  <Action
                    key={i}
                    id={`chart-ref-${section.key}`}
                    label={t('report.chart')}
                    onPress={() => onEvidence('')}
                  />
                );
            }
          })}
          <View
            style={{ borderTopWidth: 1, borderColor: colors['line-1'], paddingTop: 12, gap: 8 }}
          >
            <CopyText>{t('report.feedback')}</CopyText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Action
                id={`feedback-yes-${section.key}`}
                label={t('report.feedback.yes')}
                disabled={busy}
                selected={vote === true}
                onPress={() => void feedback(true)}
              />
              <Action
                id={`feedback-no-${section.key}`}
                label={t('report.feedback.no')}
                disabled={busy}
                selected={vote === false}
                onPress={() => void feedback(false)}
              />
            </View>
            {vote !== undefined ? <CopyText>{t('report.feedback.saved')}</CopyText> : null}
            {error ? <CopyText>{t('mobile.storage.error')}</CopyText> : null}
          </View>
        </>
      ) : null}
    </ReportCard>
  );
}
