import {
  FlexWidget,
  TextWidget,
  ImageWidget,
  requestWidgetUpdate,
  registerWidgetTaskHandler,
  type WidgetTaskHandlerProps,
} from 'react-native-android-widget';
import { currentWidget, type WidgetSnapshot } from '../../lib/engagement/planner';
import { readAndroidWidgetSnapshot } from '../../lib/engagement/widget-storage';
import { getCopy } from '../../lib/copy';
import { tarotImages } from '../../lib/reports/tarot-images';
export const widgetNames = ['TianjiSmall', 'TianjiMedium', 'TianjiLarge'] as const;
/** Android RemoteViews show only the precomputed current-day display snapshot. */
export function FortuneWidget({
  snapshot,
  size,
}: {
  snapshot: WidgetSnapshot | null;
  size: 'small' | 'medium' | 'large';
}) {
  const day = snapshot ? currentWidget(snapshot) : null;
  const t = getCopy(snapshot?.locale ?? 'zh');
  const text = {
    color: (day?.foreground ?? '#ede4d3') as `#${string}`,
    fontSize: size === 'medium' ? 10 : 11,
  };
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        height: 'match_parent',
        padding: size === 'medium' ? 6 : 10,
        borderRadius: 18,
        backgroundColor: (day?.background ?? '#0b0d17') as `#${string}`,
      }}
      clickAction="OPEN_URI"
      clickActionData={{ uri: day?.url ?? (snapshot ? 'tianji:///today' : 'tianji:///me/birth') }}
      accessibilityLabel={day?.line ?? t('mobile.widget.stale')}
    >
      <TextWidget
        text={`${day?.title ?? t('nav.today')}  ${day?.date ?? ''}${size === 'medium' ? `  ${day?.stars ?? ''}` : ''}`}
        maxLines={1}
        style={text}
      />
      {size !== 'medium' && (
        <TextWidget
          text={day?.stars ?? ''}
          style={{ ...text, fontSize: 18, color: (day?.accent ?? '#d6b770') as `#${string}` }}
        />
      )}
      {(!day?.stars || size !== 'small') && (
        <TextWidget
          text={day?.line ?? snapshot?.stale ?? t('mobile.widget.empty')}
          maxLines={day?.stars ? 2 : 4}
          style={{ ...text, fontSize: size === 'medium' ? 11 : 13 }}
        />
      )}
      {/* DESIGN-GAP: Two compact columns keep all five dimensions inside Android's 4×2 cells. */}
      {size !== 'small' && day?.stars && (
        <FlexWidget style={{ flexDirection: 'row', width: 'match_parent' }}>
          {[day.dimensions.slice(0, 3), day.dimensions.slice(3)].map((column, index) => (
            <FlexWidget key={index} style={{ flex: 1 }}>
              {column.map((dimension) => (
                <TextWidget key={dimension} text={dimension} maxLines={1} style={text} />
              ))}
            </FlexWidget>
          ))}
        </FlexWidget>
      )}
      <FlexWidget style={{ flexDirection: 'row' }}>
        {day?.color && (
          <FlexWidget
            style={{
              width: 12,
              height: 12,
              marginRight: 6,
              borderRadius: 6,
              backgroundColor: day.colorHex as `#${string}`,
            }}
          />
        )}
        <FlexWidget style={{ flex: 1 }}>
          <TextWidget text={day?.color ?? ''} maxLines={1} style={text} />
        </FlexWidget>
        {size === 'medium' && (
          <FlexWidget style={{ flex: 1 }}>
            <TextWidget text={day?.numbers ?? ''} maxLines={1} style={text} />
          </FlexWidget>
        )}
      </FlexWidget>
      {size === 'large' && <TextWidget text={day?.numbers ?? ''} maxLines={1} style={text} />}
      {size === 'large' && day?.card && (
        <FlexWidget style={{ flexDirection: 'row', marginTop: 8 }}>
          <ImageWidget
            image={tarotImages[day.card as keyof typeof tarotImages]}
            imageWidth={42}
            imageHeight={70}
            resizeMode="contain"
            style={{ rotation: day.cardReversed ? 180 : 0 }}
          />
          <TextWidget text={`${day.cardLabel}\n${day.hours}`} style={{ ...text, marginLeft: 8 }} />
        </FlexWidget>
      )}
    </FlexWidget>
  );
}
function sizeFor(name: string) {
  return name === 'TianjiSmall' ? 'small' : name === 'TianjiMedium' ? 'medium' : 'large';
}
/** Refresh every installed size on App and background updates. */
export async function updateAndroidWidgets(snapshot: WidgetSnapshot | null) {
  for (const widgetName of widgetNames)
    await requestWidgetUpdate({
      widgetName,
      renderWidget: () => <FortuneWidget snapshot={snapshot} size={sizeFor(widgetName)} />,
    });
}
/** Register once at the entry point for add/resize and periodic headless callbacks. */
export function registerAndroidWidgets() {
  registerWidgetTaskHandler(async (props: WidgetTaskHandlerProps) => {
    if (props.widgetAction === 'WIDGET_DELETED') return;
    props.renderWidget(
      <FortuneWidget
        snapshot={await readAndroidWidgetSnapshot()}
        size={sizeFor(props.widgetInfo.widgetName)}
      />,
    );
  });
}
