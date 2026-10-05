'use client';
import { useState, useTransition } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { setConfigAction } from '@/app/admin/actions';
import { SiteConfigSchema, type SiteSettings } from '@/lib/site-config-schema';
/** Controlled SiteConfig form validates the same strict boundary as the server. */
export function ConfigEditor({ initial }: { initial: SiteSettings }) {
  const t = useCopy(),
    [value, setValue] = useState(initial),
    [pending, start] = useTransition(),
    [message, setMessage] = useState('');
  const change = (next: SiteSettings) => {
    setValue(next);
    setMessage('');
  };
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        start(async () => {
          if (!SiteConfigSchema.safeParse(value).success) {
            setMessage(t('admin.error', { code: 'E_VALIDATION' }));
            return;
          }
          const result = await setConfigAction(value);
          setMessage(result.ok ? t('admin.saved') : t('admin.error', { code: result.code }));
        });
      }}
    >
      {(['zh', 'en'] as const).map((locale) => (
        <div key={locale}>
          <label htmlFor={`announcement-${locale}`}>
            {t('admin.config.announcement', { locale: t(`me.language.${locale}`) })}
          </label>
          <textarea
            id={`announcement-${locale}`}
            value={value.announcement[locale]}
            maxLength={1000}
            onChange={(e) =>
              change({
                ...value,
                announcement: { ...value.announcement, [locale]: e.target.value },
              })
            }
          />
        </div>
      ))}
      <label htmlFor="scope">{t('admin.config.scope')}</label>
      <input
        id="scope"
        value={value.announcement.scope.join(',')}
        onChange={(e) =>
          change({
            ...value,
            announcement: {
              ...value.announcement,
              scope: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            },
          })
        }
      />
      {(['startsAt', 'endsAt'] as const).map((key) => (
        <div key={key}>
          <label htmlFor={key}>{t(`admin.config.${key}`)}</label>
          <input
            id={key}
            type="datetime-local"
            value={value.announcement[key]?.slice(0, 16) ?? ''}
            onChange={(e) =>
              change({
                ...value,
                announcement: {
                  ...value.announcement,
                  [key]: e.target.value ? `${e.target.value}:00.000Z` : null,
                },
              })
            }
          />
        </div>
      ))}
      {(
        [
          'ads.enabled',
          'feature.llmPolish',
          'feature.llmChat',
          'feature.panchangDefaultOpen',
          'maintenance',
        ] as const
      ).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={value[key]}
            onChange={(e) => change({ ...value, [key]: e.target.checked })}
          />
          {t(`admin.config.${key}`)}
        </label>
      ))}
      {(['chat.freeDailyLimit', 'chat.proDailyLimit'] as const).map((key) => (
        <label key={key}>
          {t(`admin.config.${key}`)}
          <input
            type="number"
            min={0}
            max={10000}
            value={value[key]}
            onChange={(e) => change({ ...value, [key]: Number(e.target.value) })}
          />
        </label>
      ))}
      <Button disabled={pending}>{pending ? t('admin.pending') : t('admin.config.save')}</Button>
      <p role="status">{message}</p>
    </form>
  );
}
