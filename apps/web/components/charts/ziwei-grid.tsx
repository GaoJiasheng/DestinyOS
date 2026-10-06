'use client';
import { ziweiPalaceCenter } from '@tianji/ui-core';
import { useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { Mutagen, StarKey, ZiweiChart } from '@tianji/shared';
import { Dialog } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/navigation';
import { DecadalBar } from './decadal-bar';
import { MutagenBadge, ZiweiPalace, ZiweiStars } from './ziwei-palace';
import {
  connectedPalaces,
  evidencePalace,
  ZIWEI_POSITIONS,
  ZIWEI_SECTIONS,
} from './ziwei-geometry';

/** Birth time is mandatory: provide recovery links without fabricating a Zi Wei chart. */
export function ZiweiTimeRequired({ onRectify }: { onRectify?: () => void } = {}) {
  const t = useTranslations('ziwei.chart');
  const rectify = useTranslations('rectification');
  return (
    <aside className="notice ziwei-time-required" role="status">
      <p>{t('timeRequired')}</p>
      <div className="hero-actions">
        <Button type="button" asChild={!onRectify} variant="secondary" onClick={onRectify}>
          {onRectify ? rectify('entry') : <Link href="/rectify">{rectify('entry')}</Link>}
        </Button>
        <Button asChild>
          <Link href="/ziwei/new">{t('editTime')}</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/bazi/new">{t('tryBazi')}</Link>
        </Button>
      </div>
    </aside>
  );
}

/** Traditional twelve-palace chart with shared selection, evidence links and touch/keyboard fullscreen zoom. */
export function ZiweiGrid({
  chart,
  highlight,
  professional = false,
  onSelect,
}: {
  chart: ZiweiChart;
  highlight?: string;
  professional?: boolean;
  onSelect?: (section: string) => void;
}) {
  const t = useTranslations('ziwei.chart');
  const b = useTranslations('bazi');
  const [selection, setSelection] = useState(0);
  const [selectionEvidence, setSelectionEvidence] = useState(highlight);
  const [annual, setAnnual] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [zoom, setZoom] = useState(100);
  const viewport = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  // Adjust selection during render so new evidence is reflected before paint, without an effect loop.
  if (highlight !== selectionEvidence) {
    setSelectionEvidence(highlight);
    const next = evidencePalace(chart, highlight);
    if (next !== undefined) setSelection(next);
  }
  const selected = chart.palaces.find((p) => p.index === selection)!;
  const connected = connectedPalaces(chart, selection);
  const select = (index: number) => {
    setSelection(index);
    if (!fullscreen && window.matchMedia('(max-width: 767px)').matches) setFullscreen(true);
    if (!fullscreen) onSelect?.(ZIWEI_SECTIONS[chart.palaces.find((p) => p.index === index)!.key]);
  };
  const reset = () => {
    setZoom(100);
    pointers.current.clear();
    pinch.current = null;
    viewport.current?.scrollTo({ left: 0, top: 0 });
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const prior = pointers.current.get(event.pointerId);
    if (!prior) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const points = [...pointers.current.values()];
    if (points.length === 2) {
      const distance = Math.hypot(points[0]!.x - points[1]!.x, points[0]!.y - points[1]!.y);
      if (!pinch.current) pinch.current = { distance, zoom };
      else if (pinch.current.distance > 0)
        setZoom(
          Math.max(100, Math.min(300, (pinch.current.zoom * distance) / pinch.current.distance)),
        );
    } else if (viewport.current) {
      viewport.current.scrollLeft += prior.x - event.clientX;
      viewport.current.scrollTop += prior.y - event.clientY;
    }
  };
  const release = (event: PointerEvent<HTMLDivElement>) => {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  };
  const layer = (
    source: 'decadeMutagen' | 'yearMutagen',
    values: ZiweiChart['horoscope']['yearly']['mutagens'],
  ) => (
    <p className="ziwei-layer">
      <strong>{t(source)}</strong>
      {(Object.entries(values) as [Mutagen, StarKey][]).map(([value, star]) => (
        <span key={value}>
          {t(`star.${star}`)} <MutagenBadge value={value} source={source} />
        </span>
      ))}
    </p>
  );
  const details = (
    <section className="ziwei-detail" aria-label={t(`palace.${selected.key}`)}>
      <h3>
        {t(`palace.${selected.key}`)} · {b(`branches.${selected.branch}`)}
      </h3>
      <p className="muted">
        {t('related')}: {connected.map((p) => t(`palace.${p.key}`)).join(' · ')}
      </p>
      <h4>{t('major')}</h4>
      <ZiweiStars
        stars={selected.majorStars}
        major
        yearly={annual ? chart.horoscope.yearly.mutagens : undefined}
      />
      {!selected.majorStars.length ? <p>{t('empty')}</p> : null}
      <h4>{t('minor')}</h4>
      <ZiweiStars
        stars={selected.minorStars}
        yearly={annual ? chart.horoscope.yearly.mutagens : undefined}
      />
      {professional ? (
        <>
          <h4>{t('adjective')}</h4>
          <p className="ziwei-adjective">
            {selected.adjectiveStars.map((s) => t(`star.${s}`)).join(' · ')}
          </p>
          <h4>{t('cycles')}</h4>
          <p className="ziwei-adjective">
            {[selected.changsheng12, selected.boshi12, selected.jiangqian12, selected.suiqian12]
              .map((s) => t(`star.${s}`))
              .join(' · ')}
          </p>
        </>
      ) : null}
      <Button
        variant="ghost"
        onClick={() => {
          setFullscreen(false);
          onSelect?.(ZIWEI_SECTIONS[selected.key]);
        }}
      >
        {t('readSection')}
      </Button>
    </section>
  );
  const board = (expanded: boolean) => (
    <div
      className={`ziwei-board${expanded ? ' ziwei-board-expanded' : ''}`}
      style={
        expanded ? ({ width: `${zoom}%`, '--ziwei-scale': zoom / 100 } as CSSProperties) : undefined
      }
      data-testid="ziwei-board"
      aria-label={t('title')}
    >
      {chart.palaces.map((p) => (
        <ZiweiPalace
          key={p.index}
          palace={p}
          compact={!expanded}
          position={ZIWEI_POSITIONS[p.branch]}
          selected={selection === p.index}
          related={connected.some((c) => c.index === p.index)}
          current={chart.horoscope.decadal.palaceIndex === p.index}
          yearly={annual ? chart.horoscope.yearly.mutagens : undefined}
          annualPalace={annual && chart.horoscope.yearly.palaceIndex === p.index}
          onSelect={() => select(p.index)}
        />
      ))}
      <div className="ziwei-center">
        <strong>{t('title')}</strong>
        <span>{t(`bureau.${chart.basics.fiveElementsClass.name}`)}</span>
        <span>
          {t('soulMaster')} · {t(`star.${chart.basics.soulMaster}`)}
        </span>
        <span>
          {t('bodyMaster')} · {t(`star.${chart.basics.bodyMaster}`)}
        </span>
        <span>
          {t('body')} · {b(`branches.${chart.basics.bodyPalaceBranch}`)}
        </span>
        {annual ? <span>{t('year', { year: chart.horoscope.yearly.year })}</span> : null}
      </div>
      <svg
        className="ziwei-connections"
        viewBox="0 0 400 400"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polygon
          points={connected
            .slice(0, 3)
            .map((p) => {
              const { x, y } = ziweiPalaceCenter(p.branch);
              return `${x},${y}`;
            })
            .join(' ')}
        />
        {(() => {
          const { x, y } = ziweiPalaceCenter(selected.branch);
          const opposite = ziweiPalaceCenter(connected[3]!.branch);
          return <line x1={x} y1={y} x2={opposite.x} y2={opposite.y} />;
        })()}
      </svg>
    </div>
  );
  const toggle = (
    <label className="ziwei-toggle">
      <input type="checkbox" checked={annual} onChange={(e) => setAnnual(e.target.checked)} />
      {t('yearly')}
    </label>
  );
  return (
    <div className="ziwei-chart">
      <div className="ziwei-controls">
        {toggle}
        <Button
          variant="ghost"
          onClick={() => {
            reset();
            setFullscreen(true);
          }}
        >
          {t('expand')}
        </Button>
      </div>
      <p className="muted ziwei-hint">{t('hint')}</p>
      {board(false)}
      <div className="ziwei-legend">
        {(['lu', 'quan', 'ke', 'ji'] as const).map((value) => (
          <MutagenBadge key={value} value={value} source="birthMutagen" />
        ))}
      </div>
      <DecadalBar chart={chart} selected={selection} onSelect={select} />
      {layer('decadeMutagen', chart.horoscope.decadal.mutagens)}
      {annual ? layer('yearMutagen', chart.horoscope.yearly.mutagens) : null}
      {details}
      <div className="sr-only">
        <table>
          <caption>{t('table')}</caption>
          <thead>
            <tr>
              <th>{t('title')}</th>
              <th>{t('major')}</th>
              <th>{t('minor')}</th>
              <th>{t('decadal')}</th>
            </tr>
          </thead>
          <tbody>
            {chart.palaces.map((p) => (
              <tr key={p.index}>
                <th scope="row">
                  {t(`palace.${p.key}`)} · {b(`branches.${p.branch}`)}
                </th>
                <td>
                  <ZiweiStars
                    stars={p.majorStars}
                    yearly={annual ? chart.horoscope.yearly.mutagens : undefined}
                  />
                </td>
                <td>
                  <ZiweiStars
                    stars={p.minorStars}
                    yearly={annual ? chart.horoscope.yearly.mutagens : undefined}
                  />
                </td>
                <td>{t('ageRange', { from: p.decadal.fromAge, to: p.decadal.toAge })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog
        open={fullscreen}
        onOpenChange={(open) => {
          setFullscreen(open);
          if (!open) reset();
        }}
        title={t('title')}
        description={t('gesture')}
        className="ziwei-fullscreen"
      >
        <div className="ziwei-fullscreen-body">
          <div className="ziwei-controls">
            {toggle}
            <label>
              {t('zoom')}{' '}
              <input
                aria-label={t('zoom')}
                type="range"
                min={100}
                max={300}
                step={10}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
              />
            </label>
            <Button variant="ghost" onClick={reset}>
              {t('reset')}
            </Button>
          </div>
          <div
            className="ziwei-viewport"
            ref={viewport}
            onPointerDown={(e) => {
              if (e.pointerType === 'mouse' && e.button !== 0) return;
              pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              if (e.target instanceof HTMLElement) e.target.setPointerCapture(e.pointerId);
            }}
            onPointerMove={move}
            onPointerUp={release}
            onPointerCancel={release}
          >
            {board(true)}
          </div>
          {details}
        </div>
      </Dialog>
    </div>
  );
}
