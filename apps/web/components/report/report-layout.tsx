'use client';
import { AstroChartSchema, VedicChartSchema, type HouseSystem } from '@tianji/shared';
import { AstrologyReportChart } from '../charts/astrology-report-chart';
import { VedicReportChart } from '../charts/vedic-report-chart';
import { PlanetTable, HouseTable } from '../charts/planet-table';
import { AspectTable } from '../charts/aspect-table';
import { DashaTimeline } from '../charts/dasha-timeline';
import { Fragment, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { ReadingView } from '@/lib/reading-schema';
import { useCopy } from '@/i18n/use-copy';
import type { MessageKey } from '@/i18n/catalog';
import { Link, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import {
  previewAstrologyHousesAction,
  getReadingBirthAction,
  deleteReadingAction,
  renameReadingAction,
  regenerateReportAction,
  translateAnonymousReportAction,
} from '@/app/readings/actions';
import { readAnonymous, updateAnonymous } from '@/lib/anonymous-storage';
import { ShareDialog } from '@/components/share/share-dialog';
import { ChatPanel } from './chat-panel';
import { ExportMenu } from './export-menu';
import { ReportHeadline } from './report-headline';
import { ChartPreview } from './chart-preview';
import { ProfessionalData } from './professional-data';
import { SectionNav, ReportSection, AdSlot, AdviceList } from './report-section';
import {
  baziSection,
  chartPath,
  focusChartAnchor,
  isHighlighted,
  resolveChartPaths,
} from '@/components/charts/bazi-shared';
/** Shared snapshot renderer with chart anchors, professional data, owner controls and bounded ad slots. */
export function ReportLayout({
  reading,
  local = false,
  owner = false,
  plan = 'free',
  birthDetails,
}: {
  reading: ReadingView;
  local?: boolean;
  owner?: boolean;
  plan?: 'free' | 'pro';
  birthDetails?: string;
}) {
  const t = useCopy();
  const intl = useTranslations();
  const locale = useLocale() as 'zh' | 'en' | 'zh-TW';
  const router = useRouter();
  const [view, setView] = useState(reading);
  const [professional, setProfessional] = useState(false);
  const [highlight, setHighlight] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [title, setTitle] = useState(reading.title ?? '');
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(birthDetails);
  const [chartBusy, setChartBusy] = useState(false);
  const [housePreview, setHousePreview] = useState(false);
  const astro = view.system === 'astrology' ? AstroChartSchema.safeParse(view.chart) : null;
  const vedic = view.system === 'vedic' ? VedicChartSchema.safeParse(view.chart) : null;
  const switchHouses = async (houseSystem: HouseSystem) => {
    setChartBusy(true);
    try {
      const data = local ? await readAnonymous() : null;
      const snapshot = data?.readings.find((r) => r.id === view.id);
      if (local && !snapshot) throw new Error('Missing local reading');
      const result = await previewAstrologyHousesAction({
        locale,
        houseSystem,
        ...(snapshot
          ? { request: snapshot.request, createdAt: snapshot.createdAt }
          : { readingId: view.id }),
      });
      if (!result.ok) {
        toast.error(t(`report.error.${result.error.code}` as MessageKey));
        return false;
      }
      setView((v) => ({ ...v, ...result.data }));
      setHousePreview(true);
      return true;
    } catch {
      toast.error(t('report.error.E_INTERNAL'));
      return false;
    } finally {
      setChartBusy(false);
    }
  };
  const revealBirth = async () => {
    if (details || local || !owner) return;
    const result = await getReadingBirthAction(view.id);
    if (result.ok && result.data) {
      const b = result.data;
      setDetails(
        `${t(`form.birth.calendar.${b.calendar}`)} · ${b.year}-${b.month}-${b.day} · ${b.timeUnknown ? t('common.unknown') : `${b.hour}:${b.minute}`} · ${b.place?.name ?? ''} · ${b.place?.tz ?? ''}`,
      );
    } else toast.error(t('report.error.E_FORBIDDEN'));
  };
  const evidence = (path: string) => {
    // DESIGN-GAP: A filtered evidence path may match several nodes; focus the first matching snapshot node, keeping the full evidence text visible.
    const resolved = resolveChartPaths(view.chart, path)[0] ?? chartPath(path);
    setHighlight(resolved);
    setSelectedSection('');
    const root = document.getElementById('chart-root');
    if (!root) return;
    const details = root.closest('details');
    if (details) details.open = true;
    // DESIGN-GAP: Evidence paths can point inside arrays; choose the most specific rendered parent and fall back to the chart root.
    requestAnimationFrame(() => {
      const candidates = Array.from(
        root.querySelectorAll<HTMLElement | SVGElement>('[data-chart-path]'),
      )
        .filter((element) => isHighlighted(resolved, element.dataset.chartPath ?? ''))
        .sort((a, b) => (b.dataset.chartPath?.length ?? 0) - (a.dataset.chartPath?.length ?? 0));
      const exact = candidates.find(
        (element) => chartPath(element.dataset.chartPath ?? '') === resolved,
      );
      focusChartAnchor(exact ?? candidates[0] ?? root);
    });
  };
  const selectChart = (section: string, path?: string) => {
    setHighlight(path ?? section);
    const key = view.system === 'bazi' ? baziSection(section) : section;
    setSelectedSection(key);
    focusChartAnchor(document.getElementById(`section-${key}`));
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      if (housePreview && astro?.success) {
        if (!(await switchHouses(astro.data.houseSystem))) return;
      } else if (local) {
        const data = await updateAnonymous((d) => d);
        const found = data.readings.find((r) => r.id === view.id);
        if (!found) return;
        const result = await translateAnonymousReportAction(found, locale);
        if (!result.ok) {
          toast.error(t(`report.error.${result.error.code}` as MessageKey));
          return;
        }
        await updateAnonymous((d) => ({
          ...d,
          readings: d.readings.map((r) =>
            r.id === view.id
              ? {
                  ...r,
                  report: result.data,
                  [locale === 'zh-TW' ? 'reportZhTw' : locale === 'zh' ? 'reportZh' : 'reportEn']:
                    result.data,
                }
              : r,
          ),
        }));
        setView((v) => ({ ...v, report: result.data }));
      } else {
        const result = await regenerateReportAction(view.id, locale);
        if (!result.ok) {
          toast.error(t(`report.error.${result.error.code}` as MessageKey));
          return;
        }
        setView((v) => ({ ...v, report: result.data }));
      }
      toast.success(t('report.regenerated'));
    } catch {
      toast.error(t('report.error.E_INTERNAL'));
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    setBusy(true);
    try {
      if (local) {
        await updateAnonymous((d) => ({
          ...d,
          readings:
            dialog === 'delete'
              ? d.readings.filter((r) => r.id !== view.id)
              : d.readings.map((r) => (r.id === view.id ? { ...r, title } : r)),
        }));
      } else {
        const result =
          dialog === 'delete'
            ? await deleteReadingAction(view.id)
            : await renameReadingAction(view.id, title);
        if (!result.ok) {
          toast.error(t(`report.error.${result.error.code}` as MessageKey));
          return;
        }
      }
      if (dialog === 'delete') router.push('/me/history');
      else setView((v) => ({ ...v, title }));
      setDialog(null);
    } catch {
      toast.error(t('report.error.E_INTERNAL'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <article
      className={`report-layout${view.system === 'tarot' ? ' tarot-report' : ''}`}
      data-system={view.system}
    >
      <header className="report-toolbar">
        <div>
          <p className="eyebrow">{t(`nav.${view.system}` as MessageKey)}</p>
          <h1 className="type-h1">
            {view.title
              ? t('report.content', { text: view.title })
              : t(`nav.${view.system}` as MessageKey)}
          </h1>
          {view.displayName ? <p>{t('report.content', { text: view.displayName })}</p> : null}
          {view.birthYear ? (
            <p className="muted">{t('report.birthYear', { year: view.birthYear })}</p>
          ) : null}
          {astro?.success && astro.data.bodies.find((body) => body.key === 'sun') ? (
            <p className="muted">
              {intl('charts.planet.sun')} ·{' '}
              {intl(`charts.sign.${astro.data.bodies.find((body) => body.key === 'sun')!.sign}`)}
            </p>
          ) : null}
          {vedic?.success ? (
            <p className="muted">
              {intl('charts.vedic.rashi')} · {intl(`charts.sign.${vedic.data.moon.rashi}`)}
            </p>
          ) : null}

          {birthDetails || owner ? (
            <details
              onToggle={(e) => {
                if (e.currentTarget.open) void revealBirth();
              }}
            >
              <summary>{t('report.birthDetails')}</summary>
              <p>{t('report.content', { text: details ?? t('report.loading') })}</p>
            </details>
          ) : null}
        </div>
        <div className="hero-actions">
          <Button
            variant="secondary"
            aria-pressed={professional}
            onClick={() => setProfessional((v) => !v)}
          >
            {t('report.proView')}
          </Button>
          <ShareDialog readingId={view.id} local={local} />
          <ExportMenu readingId={view.id} local={local} owner={owner} />
          {owner || local ? (
            <details className="report-more">
              <summary>{t('report.more')}</summary>
              <div className="report-more-actions">
                <Button variant="ghost" onClick={() => setDialog('rename')}>
                  {t('report.rename')}
                </Button>
                <Button variant="ghost" disabled={busy} onClick={() => void regenerate()}>
                  {t('report.regenerate')}
                </Button>
                <Button variant="ghost" onClick={() => setDialog('delete')}>
                  {t('report.delete')}
                </Button>
              </div>
            </details>
          ) : null}
        </div>
      </header>
      {local ? (
        <aside className="notice">
          <p>{t('report.localNotice')}</p>
          <Link href="/auth/login" className="text-link">
            {t('report.loginSave')}
          </Link>
        </aside>
      ) : null}
      {view.meta.timeSource === 'rectified' ? (
        <aside className="notice" data-testid="rectification-notice">
          <p>
            {intl('rectification.reportNotice', {
              percent: Math.round((view.meta.rectificationConfidence ?? 0) * 100),
            })}
          </p>
          <Link href="/me/birth">{intl('rectification.editBirth')}</Link>
          {' · '}
          <Link href="/rectify">{intl('rectification.retry')}</Link>
        </aside>
      ) : null}
      {view.staleProfile ? <p className="notice">{t('report.stale')}</p> : null}
      {view.isPublic ? <p className="notice">{t('report.public')}</p> : null}
      {view.meta.warnings.map((w) => (
        <p className="notice" key={w.code}>
          {intl(w.messageKey)}
        </p>
      ))}
      <div className="report-columns">
        <ReportHeadline
          headline={{
            ...view.report.headline,
            // DESIGN-GAP: Trial similarity caps the displayed report confidence so an inferred hour cannot appear fully verified.
            confidence:
              view.meta.timeSource === 'rectified'
                ? Math.min(view.report.headline.confidence, view.meta.rectificationConfidence ?? 0)
                : view.report.headline.confidence,
          }}
        />
        <aside className="report-chart">
          <details open className="report-card">
            <summary>{t('report.chart')}</summary>
            <div
              id={astro?.success || vedic?.success ? 'chart-root' : undefined}
              data-highlight={highlight}
              className={highlight ? 'evidence-highlight' : undefined}
            >
              {astro?.success ? (
                <AstrologyReportChart
                  chart={astro.data}
                  highlight={highlight}
                  onSelect={selectChart}
                  onHouseSystem={(system) => void switchHouses(system)}
                  busy={chartBusy}
                />
              ) : vedic?.success ? (
                <VedicReportChart
                  chart={vedic.data}
                  nowISO={view.createdAt}
                  highlight={highlight}
                  onSelect={selectChart}
                />
              ) : (
                <ChartPreview
                  chart={view.chart}
                  system={view.system}
                  professional={professional}
                  highlight={highlight}
                  onSelect={selectChart}
                />
              )}
              {housePreview ? <p className="notice">{intl('charts.natal.preview')}</p> : null}
            </div>
          </details>
        </aside>
        <div className="report-body">
          <SectionNav sections={view.report.sections} />
          {view.report.sections.map((section, i) => (
            <Fragment key={section.key}>
              <ReportSection
                section={section}
                chart={view.chart}
                onEvidence={evidence}
                readingId={local ? undefined : view.id}
                highlight={highlight}
                selected={selectedSection === section.key}
                onChartSelect={selectChart}
              />
              {(i === 1 || i === 5) && i < view.report.sections.length - 1 ? (
                <AdSlot slot={i === 1 ? 'report-2-3' : 'report-6-7'} plan={plan} />
              ) : null}
            </Fragment>
          ))}
          {professional ? (
            <section className="report-card professional-view">
              <h2 className="type-h2">{t('report.proView')}</h2>
              {astro?.success ? (
                <>
                  <PlanetTable chart={astro.data} highlight={highlight} onSelect={selectChart} />
                  <AspectTable chart={astro.data} highlight={highlight} onSelect={selectChart} />
                  <HouseTable chart={astro.data} />
                </>
              ) : null}
              {vedic?.success ? (
                <>
                  <PlanetTable chart={vedic.data} highlight={highlight} onSelect={selectChart} />
                  <DashaTimeline chart={vedic.data} nowISO={view.createdAt} all />
                </>
              ) : null}
              {[
                [t('report.school'), view.meta.schoolUsed],
                [t('report.debug'), view.meta.debug],
                [t('report.rawChart'), view.chart],
                [t('report.hits'), view.report.hits],
              ].map(([label, value], i) => (
                <details key={i} open>
                  <summary>{String(label)}</summary>
                  <ProfessionalData value={value ?? {}} />
                </details>
              ))}
            </section>
          ) : null}
          {view.report.doDont ? (
            <section className="report-card">
              <h2 className="type-h2">{t('report.actions')}</h2>
              <h3>{t('report.do')}</h3>
              <AdviceList items={view.report.doDont.do} />
              <h3>{t('report.dont')}</h3>
              <AdviceList items={view.report.doDont.dont} />
            </section>
          ) : null}
          <ChatPanel readingId={view.id} system={view.system} owner={owner && !local} />
          <section className="report-card">
            <p className="legal-body">{t('legal.disclaimer.full')}</p>
            <Button variant="secondary" asChild>
              <Link href="/">{t('report.another')}</Link>
            </Button>
          </section>
        </div>
      </div>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
        title={t(dialog === 'delete' ? 'report.delete' : 'report.rename')}
        description={t(dialog === 'delete' ? 'report.deleteConfirm' : 'report.renameHint')}
      >
        {dialog === 'rename' ? (
          <label className="birth-field">
            {t('report.rename')}
            <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
          </label>
        ) : null}
        <div className="hero-actions">
          <Button variant="secondary" disabled={busy} onClick={() => setDialog(null)}>
            {t('report.cancel')}
          </Button>
          <Button
            disabled={busy || (dialog === 'rename' && !title.trim())}
            onClick={() => void confirm()}
          >
            {t('report.confirm')}
          </Button>
        </div>
      </Dialog>
    </article>
  );
}
