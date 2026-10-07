import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useProfiles } from '../lib/profiles';
import { getLocalStore } from '../lib/data/store';
import type { LocalReading, LocalRecord } from '../lib/data/models';
import { ReportSystemSchema } from '../lib/reports/readings';
import { useCopy } from '../lib/copy';
import { Page, Action, CopyText } from './native-ui';
/** History follows the selected profile, including both sides of synastry and unassigned divinations. */
export function HistoryScreen() {
  const t = useCopy(),
    router = useRouter(),
    { active } = useProfiles();
  const [readings, setReadings] = useState<LocalRecord<LocalReading>[]>([]),
    [loading, setLoading] = useState(true),
    [failed, setFailed] = useState(false),
    [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setReadings([]);
    setFailed(false);
    void getLocalStore()
      .then((store) => store.readings.list(500))
      .then((items) => {
        if (alive)
          setReadings(
            items.filter(
              (item) =>
                !item.data?.profileId ||
                item.data.profileId === active?.id ||
                item.data.inputSnapshot.partnerProfileId === active?.id,
            ),
          );
      })
      .catch(() => {
        if (alive) setFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [active?.id, retry]);
  return (
    <Page title="me.history">
      <Action label={t('nav.me')} onPress={() => router.push('/me')} />
      {loading && <CopyText>{t('common.loading')}</CopyText>}
      {failed && (
        <>
          <CopyText>{t('mobile.storage.error')}</CopyText>
          <Action label={t('common.retry')} onPress={() => setRetry((v) => v + 1)} />
        </>
      )}
      {!loading && !failed && !readings.length && <CopyText>{t('mobile.history.empty')}</CopyText>}
      {readings.map((item) => {
        const system = ReportSystemSchema.safeParse(item.data?.system);
        return system.success ? (
          <Action
            key={item.id}
            id={`history-${item.id}`}
            label={t('mobile.history.item', {
              system: t(`nav.${system.data}`),
              date: item.createdAt.slice(0, 10),
            })}
            onPress={() =>
              router.push({
                pathname: '/[system]/r/[id]',
                params: { system: system.data, id: item.id },
              })
            }
          />
        ) : null;
      })}
    </Page>
  );
}
