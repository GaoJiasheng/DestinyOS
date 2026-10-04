'use client';
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
  getReadingBirthAction,
  deleteReadingAction,
  renameReadingAction,
  regenerateReportAction,
  translateAnonymousReportAction,
} from '@/app/readings/actions';
import { updateAnonymous } from '@/lib/anonymous-storage';
import { ReportHeadline } from './report-headline';
import { ChartPreview } from './chart-preview';
import { ProfessionalData } from './professional-data';
import { SectionNav, ReportSection, AdSlot, AdviceList } from './report-section';
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
  const locale = useLocale() as 'zh' | 'en';
  const router = useRouter();
  const [view, setView] = useState(reading);
  const [professional, setProfessional] = useState(false);
  const [highlight, setHighlight] = useState('');
  const [dialog, setDialog] = useState<'rename' | 'delete' | null>(null);
  const [title, setTitle] = useState(reading.title ?? '');
  const [busy, setBusy] = useState(false);
  const [details, setDetails] = useState(birthDetails);
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
    setHighlight(path);
    document.getElementById('chart-root')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const regenerate = async () => {
    setBusy(true);
    try {
      if (local) {
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
                  [locale === 'zh' ? 'reportZh' : 'reportEn']: result.data,
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
    <article className="report-layout">
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
          <Button variant="ghost" onClick={() => toast(t('report.sharePlaceholder'))}>
            {t('report.share')}
          </Button>
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
      {view.staleProfile ? <p className="notice">{t('report.stale')}</p> : null}
      {view.isPublic ? <p className="notice">{t('report.public')}</p> : null}
      {view.meta.warnings.map((w) => (
        <p className="notice" key={w.code}>
          {intl(w.messageKey)}
        </p>
      ))}
      <div className="report-columns">
        <ReportHeadline headline={view.report.headline} />
        <aside className="report-chart">
          <details open className="report-card">
            <summary>{t('report.chart')}</summary>
            <ChartPreview
              chart={view.chart}
              system={view.system}
              professional={professional}
              highlight={highlight}
              onSelect={(section) =>
                document
                  .getElementById(`section-${section}`)
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            />
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
              />
              {i === 1 || i === 5 ? (
                <AdSlot slot={`report-${i === 1 ? '2-3' : '6-7'}`} plan={plan} />
              ) : null}
            </Fragment>
          ))}
          {professional ? (
            <section className="report-card professional-view">
              <h2 className="type-h2">{t('report.proView')}</h2>
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
