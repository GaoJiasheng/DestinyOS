import { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { Skia, useFont, useImage } from '@shopify/react-native-skia';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { SCORE_DIMENSIONS } from '@tianji/ui-core';
import { designTokens } from '@tianji/ui-core/tokens';
import type { PublicShare } from '@tianji/ui-core/share-projection';
import { brand } from '@tianji/shared';
import noto from '../../assets/fonts/noto.ttf';
import inter from '../../assets/fonts/inter.ttf';
import qrZh from '../../assets/share/qr-zh.png';
import qrEn from '../../assets/share/qr-en.png';
import qrTW from '../../assets/share/qr-zh-TW.png';
import { shareLines } from '../../lib/daily/share-lines';
import { useCopy } from '../../lib/copy';
import { useChartLabel } from './report-ui';
import { Action, CopyText } from '../native-ui';
/** Offscreen PNG accepts only the shared public projection, never a reading or birth snapshot. */
export function ShareCard({ value }: { value: PublicShare }) {
  const t = useCopy(),
    label = useChartLabel();
  const [format, setFormat] = useState<'story' | 'landscape'>('story');
  const landscape = format === 'landscape';
  const qr = useImage(value.locale === 'en' ? qrEn : value.locale === 'zh-TW' ? qrTW : qrZh);
  const font = useFont(value.locale === 'en' ? inter : noto, 48);
  const [uri, setUri] = useState<string | null>(null),
    [failed, setFailed] = useState(false),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setUri(null);
    setFailed(false);
    if (!font || !qr) return;
    let file: File | undefined;
    try {
      const surface = Skia.Surface.MakeOffscreen(landscape ? 1200 : 1080, landscape ? 630 : 1920);
      if (!surface) throw new Error('E_RENDER');
      const canvas = surface.getCanvas(),
        paint = Skia.Paint();
      canvas.clear(Skia.Color(designTokens.base['bg-0']));
      paint.setColor(Skia.Color(designTokens.base.gold));
      paint.setStyle(1);
      paint.setStrokeWidth(3);
      canvas.drawRect(
        Skia.XYWHRect(
          landscape ? 24 : 48,
          landscape ? 24 : 48,
          landscape ? 1152 : 984,
          landscape ? 582 : 1824,
        ),
        paint,
      );
      paint.setStyle(0);
      for (let i = 0; i < 150; i++)
        canvas.drawCircle(
          (i * 127 + 51) % (landscape ? 1200 : 1080),
          (i * 193 + 87) % (landscape ? 630 : 1920),
          i % 5 ? 1 : 3,
          paint,
        );
      let y = landscape ? 75 : 170;
      let width = landscape ? 630 : 860;
      const line = (text: string, size = 48, max = 4) => {
        size = landscape ? Math.round(size * 0.6) : size;
        font.setSize(size);
        const lines = shareLines(text, value.locale, (part) => font.measureText(part).width, width);
        for (const part of lines.slice(0, max)) {
          canvas.drawText(part, landscape ? 65 : 110, y, paint, font);
          y += size * (landscape ? 1.3 : 1.6);
        }
        y += landscape ? 8 : 28;
      };
      line(
        t(value.locale === 'en' ? 'brand.nameEn' : 'brand.nameZh', {
          name:
            value.locale === 'en'
              ? brand.nameEn
              : value.locale === 'zh-TW'
                ? brand.nameZhTW
                : brand.nameZh,
        }),
      );
      line(t(`share.template.${value.template}`), 38, 1);
      line(value.headline, 42, 3);
      line(value.keywords.join(' · '), 32, 2);
      for (const dim of SCORE_DIMENSIONS) {
        const baseline = y;
        line(t(`report.dim.${dim}`), 32, 1);
        const count = Math.max(0, Math.min(5, value.scores[dim]));
        for (let star = 0; star < 5; star++) {
          const path = Skia.PathBuilder.Make();
          const cx = (landscape ? 255 : 430) + star * (landscape ? 25 : 45);
          const cy = baseline - (landscape ? 7 : 12);
          const radius = landscape ? 9 : 16;
          for (let point = 0; point < 10; point++) {
            const angle = (point * Math.PI) / 5 - Math.PI / 2;
            const r = point % 2 ? radius * 0.45 : radius;
            const x = cx + Math.cos(angle) * r;
            const y = cy + Math.sin(angle) * r;
            if (point === 0) path.moveTo(x, y);
            else path.lineTo(x, y);
          }
          path.close();
          paint.setStyle(star < count ? 0 : 1);
          canvas.drawPath(path.detach(), paint);
        }
        paint.setStyle(0);
      }
      if (value.diagram) {
        const items = value.diagram.items;
        // DESIGN-GAP: Compact public diagrams use shared derived items; full private chart layouts cannot enter a poster.
        if (value.diagram.kind === 'wheel') {
          const centerY = landscape ? 265 : Math.min(Math.max(y + 270, 1100), 1330);
          const centerX = landscape ? 940 : 540;
          const outerRadius = landscape ? 170 : 250;
          paint.setStyle(1);
          canvas.drawCircle(centerX, centerY, outerRadius, paint);
          paint.setStyle(0);
          items.forEach((item, i) => {
            const angle = ((item.longitude ?? 0) * Math.PI) / 180;
            const radius = item.label === 'synastry.b' ? outerRadius * 0.8 : outerRadius;
            canvas.drawCircle(
              centerX + Math.cos(angle) * radius,
              centerY + Math.sin(angle) * radius,
              i % 2 ? 9 : 13,
              paint,
            );
          });
        } else if (value.diagram.kind === 'hexagram') {
          const x = landscape ? 760 : 260;
          const top = landscape ? 170 : Math.min(Math.max(y, 1000), 1160);
          const fullWidth = landscape ? 340 : 560;
          items.slice(0, 6).forEach((item, i) => {
            const lineY = top + (5 - i) * (landscape ? 44 : 55);
            const halfWidth = fullWidth * 0.42;
            canvas.drawRect(
              Skia.XYWHRect(x, lineY, item.yang ? fullWidth : halfWidth, landscape ? 10 : 18),
              paint,
            );
            if (!item.yang)
              canvas.drawRect(
                Skia.XYWHRect(x + fullWidth - halfWidth, lineY, halfWidth, landscape ? 10 : 18),
                paint,
              );
          });
        } else {
          font.setSize(landscape ? 22 : 34);
          // DESIGN-GAP: Fixed poster cells ellipsize long translated labels; public links retain complete names and diagrams.
          const caption = (text: string) => {
            const lines = shareLines(
              text,
              value.locale,
              (part) => font.measureText(part).width,
              (landscape ? 145 : 292) - 16 - font.measureText('…').width,
            );
            return `${lines[0] ?? ''}${lines.length > 1 ? '…' : ''}`;
          };
          items.slice(0, 12).forEach((item, i) => {
            const x = (landscape ? 730 : 110) + (i % 3) * (landscape ? 145 : 292),
              row = Math.floor(i / 3),
              top =
                (landscape ? 190 : Math.min(Math.max(y, 1000), 1160)) +
                row * (landscape ? 70 : 100);
            canvas.drawText(caption(label(item.label)), x, top, paint, font);
            canvas.drawText(
              caption(
                item.value
                  .split('|')
                  .map((part) => label(part))
                  .join(' '),
              ),
              x,
              top + (landscape ? 32 : 50),
              paint,
              font,
            );
          });
        }
      }
      // DESIGN-GAP: Level 2 prose is available through its public link; the fixed story card remains a readable conclusion preview.
      // DESIGN-GAP: QR codes target the locale's public Today page, so an offline poster never exposes a private report identifier.
      canvas.drawImageRect(
        qr,
        Skia.XYWHRect(0, 0, qr.width(), qr.height()),
        Skia.XYWHRect(
          landscape ? 1020 : 790,
          landscape ? 455 : 1590,
          landscape ? 120 : 180,
          landscape ? 120 : 180,
        ),
        paint,
      );
      width = landscape ? 720 : 620;
      y = landscape ? 552 : 1640;
      line(t('report.disclaimer.short'), 30, 3);
      y = landscape ? 595 : 1800;
      line(brand.domain, 30, 1);
      surface.flush();
      file = new File(Paths.cache, `report-card-${Date.now()}.png`);
      file.write(surface.makeImageSnapshot().encodeToBytes());
      setUri(file.uri);
    } catch {
      setFailed(true);
    }
    return () => {
      if (file?.exists) file.delete();
    };
  }, [value, font, qr, landscape, label, t]);
  return (
    <>
      {(['story', 'landscape'] as const).map((item) => (
        <Action
          key={item}
          id={`share-format-${item}`}
          label={t(`mobile.share.${item}`)}
          selected={format === item}
          disabled={busy}
          onPress={() => setFormat(item)}
        />
      ))}
      {uri ? (
        <Image
          testID="share-card-image"
          source={{ uri }}
          accessibilityLabel={t('share.preview')}
          style={{
            width: landscape ? 300 : 200,
            height: landscape ? 158 : 356,
            alignSelf: 'center',
          }}
        />
      ) : (
        <CopyText>{t(failed ? 'export.failed' : 'common.loading')}</CopyText>
      )}
      <Action
        id="share-card-native"
        label={t('share.native')}
        disabled={!uri || busy}
        onPress={() => {
          if (!uri) return;
          setBusy(true);
          void Sharing.isAvailableAsync()
            .then((available) => {
              if (!available) throw new Error('E_SHARE');
              return Sharing.shareAsync(uri, {
                mimeType: 'image/png',
                UTI: 'public.png',
                dialogTitle: t('share.preview'),
              });
            })
            .catch(() => setFailed(true))
            .finally(() => setBusy(false));
        }}
      />
      {failed && uri && <CopyText>{t('export.failed')}</CopyText>}
    </>
  );
}
