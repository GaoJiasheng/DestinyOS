import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { useFont, useImage, Skia } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { brand } from '@tianji/shared/brand';
import { dailyStars } from '@tianji/engine/daily';
import { designTokens } from '@tianji/ui-core/tokens';
import noto from '../../assets/fonts/noto.ttf';
import inter from '../../assets/fonts/inter.ttf';
import qrZh from '../../assets/share/qr-zh.png';
import qrEn from '../../assets/share/qr-en.png';
import qrTW from '../../assets/share/qr-zh-TW.png';
import type { NativeDaily } from '../../lib/daily/service';
import { shareLines } from '../../lib/daily/share-lines';
import { usePreferences } from '../../lib/preferences';
import { useCopy } from '../../lib/copy';
import { useChartLabel, ReportSheet } from '../report/report-ui';
import { Action, CopyText } from '../native-ui';

/** Render a 1080×1920 public conclusion card offscreen; this input contains no birth/profile/name fields. */
export function DailyShare({ value, close }: { value: NativeDaily; close: () => void }) {
  const t = useCopy(),
    label = useChartLabel(),
    locale = usePreferences((s) => s.locale);
  const font = useFont(locale === 'en' ? inter : noto, 54);
  const qr = useImage(locale === 'en' ? qrEn : locale === 'zh-TW' ? qrTW : qrZh);
  const [uri, setUri] = useState<string | null>(null),
    [error, setError] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!font || !qr) return;
    let file: File | undefined;
    font.setSize(54);
    try {
      const surface = Skia.Surface.MakeOffscreen(1080, 1920);
      if (!surface) throw new Error('E_RENDER');
      const canvas = surface.getCanvas(),
        paint = Skia.Paint();
      canvas.clear(Skia.Color(designTokens.base['bg-0']));
      paint.setColor(Skia.Color(designTokens.base.gold));
      paint.setStrokeWidth(3);
      paint.setStyle(1);
      canvas.drawRect(Skia.XYWHRect(48, 48, 984, 1824), paint);
      paint.setStyle(0);
      // DESIGN-GAP: Share backgrounds use deterministic procedural stars, avoiding location or a sky timestamp disclosure.
      for (let i = 0; i < 180; i++)
        canvas.drawCircle((i * 127 + 51) % 1080, (i * 193 + 87) % 1920, i % 5 ? 1 : 3, paint);
      let y = 190;
      function line(text: string) {
        const lines = shareLines(text, locale, (line) => font!.measureText(line).width, 860);
        for (const [i, textLine] of lines.entries()) {
          canvas.drawText(textLine, 110, y, paint, font!);
          if (i < lines.length - 1) y += 80;
        }
        y += 100;
      }
      line(
        t(locale === 'en' ? 'brand.nameEn' : 'brand.nameZh', {
          name: locale === 'en' ? brand.nameEn : locale === 'zh-TW' ? brand.nameZhTW : brand.nameZh,
        }),
      );
      line(t('share.template.daily'));
      line(t('report.content', { text: value.chart.date.local }));
      y += 90;
      line(label(value.chart.oneLiner));
      y += 80;
      line(t('daily.stars', { count: dailyStars(value.chart.scores.overall) }));
      line(`${t('daily.lucky.color')} · ${label(value.chart.bazi.luckyColor[0]!)}`);
      paint.setColor(Skia.Color(value.chart.bazi.luckyColorHex));
      canvas.drawCircle(850, y - 135, 24, paint);
      paint.setColor(Skia.Color(designTokens.base.gold));
      line(`${t('daily.lucky.number')} · ${value.chart.bazi.luckyNumbers.join(' / ')}`);
      // DESIGN-GAP: Static locale QR assets target the public Today route, never a private profile/report ID.
      canvas.drawImageRect(
        qr,
        Skia.XYWHRect(0, 0, qr.width(), qr.height()),
        Skia.XYWHRect(790, 1350, 200, 200),
        paint,
      );
      y = 1590;
      font.setSize(30);
      line(t('report.disclaimer.short'));
      line(t('report.content', { text: brand.domain }));
      surface.flush();
      file = new File(Paths.cache, `daily-card-${Date.now()}.png`);
      file.write(surface.makeImageSnapshot().encodeToBytes());
      setUri(file.uri);
    } catch {
      setError(true);
    }
    return () => {
      if (file?.exists) file.delete();
    };
  }, [font, qr, locale, label, t, value]);
  return (
    <ReportSheet title={t('share.preview')} close={close} id="daily-share-preview">
      <CopyText>{t('share.help')}</CopyText>
      {uri ? (
        <Image
          source={{ uri }}
          accessibilityLabel={t('share.preview')}
          style={{ width: 240, height: 426, alignSelf: 'center' }}
        />
      ) : (
        <CopyText>{t('common.loading')}</CopyText>
      )}
      {error && <CopyText>{t('mobile.storage.error')}</CopyText>}
      <Action
        id="daily-share-native"
        disabled={!uri || busy}
        label={t('share.native')}
        onPress={() => {
          if (!uri) return;
          setBusy(true);
          setError(false);
          void Sharing.isAvailableAsync()
            .then((available) => {
              if (!available) throw new Error('E_SHARE');
              return Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                UTI: 'public.png',
                dialogTitle: t('share.template.daily'),
              });
            })
            .catch(() => setError(true))
            .finally(() => setBusy(false));
        }}
      />
    </ReportSheet>
  );
}
