import { useState } from 'react';
import { Switch, View, Linking, Platform } from 'react-native';
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
    [denied, setDenied] = useState(false),
    [picking, setPicking] = useState(false),
    [draft, setDraft] = useState<Date | null>(null);
  async function save(requested: Partial<Settings>) {
    setBusy(true);
    setError(false);
    setSaved(false);
    try {
      let patch = requested;
      if (requested.dailyPushEnabled === true) {
        const granted = await requestNotificationPermission(t('mobile.push.title'));
        setDenied(!granted);
        // A switch that shows "on" while the OS blocks delivery would promise reminders that never arrive.
        if (!granted) patch = { ...requested, dailyPushEnabled: false };
      }
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
  const saveTime = (value: Date) =>
    void save({
      dailyPushTime: `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`,
    });
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
      {/* DESIGN-GAP: Pick first and save once; saving on every spinner tick rescheduled 7 days of reminders and disabled the wheel mid-scroll. */}
      {!picking && (
        <Action
          id="push-time-open"
          disabled={busy}
          label={t('mobile.push.timeChange')}
          onPress={() => {
            setDraft(time);
            setPicking(true);
          }}
        />
      )}
      {picking && Platform.OS !== 'ios' && (
        // Android renders this as a modal dialog, so mount it only on request.
        <DateTimePicker
          testID="push-time"
          value={draft ?? time}
          mode="time"
          onChange={(event, value) => {
            setPicking(false);
            if (event.type === 'set' && value) saveTime(value);
          }}
        />
      )}
      {picking && Platform.OS === 'ios' && (
        <>
          <DateTimePicker
            testID="push-time"
            value={draft ?? time}
            locale={locale}
            mode="time"
            display="spinner"
            themeVariant="dark"
            onChange={(_, value) => {
              if (value) setDraft(value);
            }}
          />
          <Action
            id="push-time-confirm"
            disabled={busy}
            label={t('mobile.push.timeConfirm')}
            onPress={() => {
              setPicking(false);
              if (draft) saveTime(draft);
            }}
          />
          <Action
            id="push-time-cancel"
            label={t('profiles.cancel')}
            onPress={() => setPicking(false)}
          />
        </>
      )}
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
          <CopyText testID="push-denied">{t('mobile.push.denied')}</CopyText>
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
        label={t('mobile.push.refresh')}
        onPress={() => void save({})}
      />
      {saved && <CopyText testID="push-saved">{t('mobile.push.saved')}</CopyText>}
      {error && <CopyText testID="push-error">{t('mobile.push.error')}</CopyText>}
    </Page>
  );
}
