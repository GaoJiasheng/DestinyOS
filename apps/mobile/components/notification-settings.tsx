import { useState } from 'react';
import { Switch, View, Linking } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { usePreferences } from '../lib/preferences';
import { useProfiles } from '../lib/profiles';
import { useCopy } from '../lib/copy';
import { useTheme } from '../lib/theme';
import { Page, CopyText, Action } from './native-ui';
import { refreshEngagement } from '../lib/engagement/service';
import { requestNotificationPermission } from '../lib/notifications';
import type { Settings } from '../lib/data/models';
// DESIGN-GAP: The native notification/time/widget controls use /me/settings/notifications
// as a focused subpage of the documented /me/settings route. Existing preference names remain unchanged.
/** Native controls save to SQLCipher and immediately replace rolling schedules and widget data. */
export function NotificationSettings() {
  const locale = usePreferences((state) => state.locale);
  const { settings, active, updateSettings } = useProfiles(),
    t = useCopy(),
    { colors } = useTheme();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [saved, setSaved] = useState(false),
    [denied, setDenied] = useState(false);
  async function save(patch: Partial<Settings>) {
    setBusy(true);
    setError(false);
    setSaved(false);
    try {
      if (
        patch.dailyPushEnabled === true &&
        !(await requestNotificationPermission(t('mobile.push.title')))
      )
        setDenied(true);
      await updateSettings(patch);
      await refreshEngagement({
        profile: active,
        settings: { ...settings, ...patch, locale: usePreferences.getState().locale },
      });
      setSaved(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  const time = new Date();
  const [hour, minute] = settings.dailyPushTime.split(':').map(Number);
  time.setHours(hour!, minute!, 0, 0);
  return (
    <Page title="mobile.push.title">
      <CopyText>{t('mobile.push.help')}</CopyText>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <CopyText>{t('mobile.push.title')}</CopyText>
        <Switch
          testID="push-enabled"
          accessibilityLabel={t('mobile.push.title')}
          disabled={busy}
          value={settings.dailyPushEnabled}
          onValueChange={(dailyPushEnabled) => void save({ dailyPushEnabled })}
          trackColor={{ true: colors.gold }}
        />
      </View>
      <CopyText>
        {t('mobile.push.time')} · {settings.dailyPushTime}
      </CopyText>
      <DateTimePicker
        testID="push-time"
        value={time}
        locale={locale}
        mode="time"
        display="spinner"
        themeVariant="dark"
        disabled={busy}
        onChange={(_, value) => {
          if (value)
            void save({
              dailyPushTime: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
            });
        }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <CopyText>{t('mobile.push.special')}</CopyText>
        <Switch
          testID="push-special"
          accessibilityLabel={t('mobile.push.special')}
          disabled={busy}
          value={settings.specialDayReminders}
          onValueChange={(specialDayReminders) => void save({ specialDayReminders })}
          trackColor={{ true: colors.gold }}
        />
      </View>
      {denied && (
        <>
          <CopyText testID="push-denied">{t('mobile.onboarding.notifications.denied')}</CopyText>
          <Action
            label={t('mobile.daily.openSettings')}
            onPress={() => void Linking.openSettings().catch(() => setError(true))}
          />
        </>
      )}
      <CopyText title>{t('mobile.widget.theme')}</CopyText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(['auto', 'east', 'west', 'vedic'] as const).map((widgetTheme) => (
          <Action
            key={widgetTheme}
            id={`widget-theme-${widgetTheme}`}
            label={t(`nav.theme.${widgetTheme}`)}
            selected={settings.widgetTheme === widgetTheme}
            disabled={busy}
            onPress={() => void save({ widgetTheme })}
          />
        ))}
      </View>
      <CopyText>{t('mobile.widget.help')}</CopyText>
      <Action
        id="push-refresh"
        disabled={busy}
        label={t('mobile.profiles.retry')}
        onPress={() => void save({})}
      />
      {saved && <CopyText testID="push-saved">{t('mobile.push.saved')}</CopyText>}
      {error && <CopyText testID="push-error">{t('mobile.push.error')}</CopyText>}
    </Page>
  );
}
