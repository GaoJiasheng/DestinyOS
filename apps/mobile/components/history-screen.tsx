import { FlatList } from 'react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { useProfiles } from '../lib/profiles';
import { usePreferences } from '../lib/preferences';
import { getLocalStore } from '../lib/data/store';
import type { LocalReading, LocalRecord } from '../lib/data/models';
import { ReportSystemSchema } from '../lib/reports/readings';
import { useCopy } from '../lib/copy';
import { Page, Action, CopyText } from './native-ui';

const PAGE = 50;
type Item = LocalRecord<LocalReading>;
/** Short question for divinations; snapshots may hold a plain string or a structured cast. */
function questionOf(item: Item): string | null {
  const question = item.data?.inputSnapshot.question;
  const text =
    typeof question === 'string'
      ? question
      : question && typeof question === 'object'
        ? [question.text, question.question].find((v) => typeof v === 'string')
        : undefined;
  if (typeof text !== 'string' || !text.trim()) return null;
  const trimmed = text.trim();
  return trimmed.length > 24 ? `${trimmed.slice(0, 24)}…` : trimmed;
}
/**
 * History follows the selected profile, including both sides of synastry and unassigned divinations.
 * Daily snapshots are excluded in SQL so years of daily use never push real reports out of a page.
 */
export function HistoryScreen() {
  const t = useCopy(),
    router = useRouter(),
    { active, profiles, settings } = useProfiles(),
    locale = usePreferences((s) => s.locale);
  const tz = settings?.tz ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [readings, setReadings] = useState<Item[]>([]),
    [loading, setLoading] = useState(true),
    [more, setMore] = useState(false),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  // Generation guards late pages after a profile switch or retry.
  const generation = useRef(0),
    offset = useRef(0),
    fetching = useRef(false);
  const activeId = active?.id ?? null;
  const loadPage = useCallback(
    async (first: boolean) => {
      if (fetching.current && !first) return;
      const run = first ? ++generation.current : generation.current;
      if (first) offset.current = 0;
      fetching.current = true;
      setLoading(true);
      setFailed(false);
      try {
        const store = await getLocalStore();
        let visible: Item[] = [],
          full = false;
        // Skip pages the guard below empties entirely, so the list never stalls on a blank page.
        for (let pages = 0; !visible.length && pages < 10; pages++) {
          const page = await store.readings.listBySystem(
            { except: ['daily'], profileId: activeId },
            PAGE,
            offset.current,
          );
          if (run !== generation.current) return;
          offset.current += page.length;
          // A short page may only mean damaged rows were skipped; stop at the first empty page.
          full = page.length > 0;
          // Same rule as the SQL filter, kept as a guard for records from older clients.
          visible = page.filter(
            (item) =>
              !item.data?.profileId ||
              item.data.profileId === activeId ||
              item.data.inputSnapshot.partnerProfileId === activeId,
          );
          if (!full) break;
        }
        setReadings((previous) => (first ? visible : [...previous, ...visible]));
        setMore(full);
      } catch {
        if (run === generation.current) setFailed(true);
      } finally {
        if (run === generation.current) {
          fetching.current = false;
          setLoading(false);
        }
      }
    },
    [activeId],
  );
  useEffect(() => {
    setReadings([]);
    setMore(false);
    void loadPage(true);
  }, [loadPage, retry]);
  const dateOf = (iso: string) => {
    try {
      return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: tz }).format(
        new Date(iso),
      );
    } catch {
      return iso.slice(0, 10);
    }
  };
  const detailOf = (item: Item) => {
    const question = questionOf(item);
    if (question) return question;
    const profile = profiles?.find((p) => p.id === item.data?.profileId);
    return profile ? profile.data?.name || t('mobile.profiles.unnamed') : null;
  };
  // DESIGN-GAP: Variable-height translated rows use FlatList windowing without fixed getItemLayout so large text never overlaps.
  return (
    <Page title="me.history" scroll={false}>
      <Action label={t('nav.me')} onPress={() => router.push('/me')} />
      {loading && !readings.length && <CopyText>{t('common.loading')}</CopyText>}
      {failed && (
        <>
          <CopyText>{t('mobile.storage.error')}</CopyText>
          <Action label={t('common.retry')} onPress={() => setRetry((v) => v + 1)} />
        </>
      )}
      {!loading && !failed && !readings.length && (
        <>
          <CopyText testID="history-empty">{t('mobile.history.empty')}</CopyText>
          <Action
            id="history-start"
            label={t('home.cta.start')}
            onPress={() => router.push('/reading')}
          />
        </>
      )}
      <FlatList
        testID="history-list"
        style={{ flex: 1 }}
        data={readings}
        keyExtractor={(item) => item.id}
        initialNumToRender={12}
        maxToRenderPerBatch={6}
        windowSize={5}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (more && !failed) void loadPage(false);
        }}
        ListFooterComponent={
          loading && readings.length ? <CopyText>{t('common.loading')}</CopyText> : null
        }
        contentContainerStyle={{ gap: 12, paddingBottom: 24 }}
        renderItem={({ item }) => {
          const system = ReportSystemSchema.safeParse(item.data?.system);
          if (!system.success) return null;
          const detail = detailOf(item),
            values = { system: t(`nav.${system.data}`), date: dateOf(item.createdAt) };
          return (
            <Action
              key={item.id}
              id={`history-${item.id}`}
              label={
                detail
                  ? t('mobile.history.itemDetail', { ...values, detail })
                  : t('mobile.history.item', values)
              }
              onPress={() =>
                router.push({
                  pathname: '/[system]/r/[id]',
                  params: { system: system.data, id: item.id },
                })
              }
            />
          );
        }}
      />
    </Page>
  );
}
