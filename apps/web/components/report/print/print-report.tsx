'use client';
import { useEffect, useRef } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { brand } from '@tianji/shared/brand';
import {
  BaziChartSchema,
  ZiweiChartSchema,
  AstroChartSchema,
  VedicChartSchema,
} from '@tianji/shared';
import type { ReadingView } from '@/lib/reading-schema';
import { PrintChart } from './print-chart';
import { paginatePrint } from './print-pagination';
const dims = ['career', 'wealth', 'love', 'health', 'social'] as const;
/** Continuous poster or compact, privacy-minimized A4 report; source blocks are measured after every font and image loads. */
export function PrintReport({
  reading,
  theme,
  qr,
  layout = 'pdf',
  width = 1242,
}: {
  reading: ReadingView;
  theme: 'dark' | 'light';
  qr: string;
  layout?: 'pdf' | 'poster' | 'cover';
  width?: 1242 | 1600;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const root = useRef<HTMLDivElement>(null);
  const text = (value: string) =>
    t('report.content', {
      text: value
        .replace(/\[\[term:([^\]]+)\]\]/g, (_, key: string) => t(`glossary.${key}.term`))
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'),
    });
  useEffect(() => {
    let active = true;
    const element = root.current;
    void (async () => {
      const prose = element?.querySelector('.print-source')?.textContent ?? '';
      const headings = Array.from(
        element?.querySelectorAll('h1, h2, .print-brand-zh, .print-ganzhi') ?? [],
      )
        .map((node) => node.textContent)
        .join('');
      await Promise.all([
        // DESIGN-GAP: The source is hidden in print media, so explicitly load the condensed PDF font before cloning or measuring text.
        ...(layout === 'pdf' && locale === 'en'
          ? [document.fonts.load('12px "Noto Sans Variable"', prose)]
          : []),
        document.fonts.load('14px "Noto Serif SC"', prose),
        document.fonts.load('24px "LXGW WenKai"', headings),
        document.fonts.load('24px "Cinzel"', headings),
        document.fonts.load('14px "Cormorant Garamond"', prose),
        document.fonts.load('22px "Tianji Print Symbols"', '♈♉♊♋♌♍♎♏♐♑♒♓☉☽☿♀♂♃♄♅♆♇☊⚷⚸'),
      ]);
      await document.fonts.ready;
      await Promise.all(
        Array.from(element?.querySelectorAll('img') ?? []).map((img) => img.decode()),
      );
      if (active && element) {
        try {
          if (layout === 'pdf') paginatePrint(element);
          element.dataset.ready = 'true';
        } catch {
          element.dataset.ready = 'error';
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [layout, width, locale]);
  const b = BaziChartSchema.safeParse(reading.chart),
    z = ZiweiChartSchema.safeParse(reading.chart),
    a = AstroChartSchema.safeParse(reading.chart),
    v = VedicChartSchema.safeParse(reading.chart);
  const zodiac = b.success
    ? t(`daily.zodiac.${b.data.pillars.year.branch}`)
    : z.success
      ? t(`daily.zodiac.${z.data.basics.zodiac}`)
      : a.success
        ? t(`charts.sign.${a.data.bodies.find((p) => p.key === 'sun')!.sign}`)
        : v.success
          ? t(`charts.sign.${v.data.moon.rashi}`)
          : '';
  const point = (i: number, radius: number) =>
    `${180 + Math.sin((i * Math.PI * 2) / 5) * radius},${175 - Math.cos((i * Math.PI * 2) / 5) * radius}`;
  // DESIGN-GAP: Saved reports can contain fewer than three keywords; complete the cover using existing highest-scored dimension labels, without inventing traits.
  const keywords = [
    ...new Set([
      ...reading.report.headline.keywords,
      ...[...dims]
        .sort((a, b) => reading.report.headline.scores[b] - reading.report.headline.scores[a])
        .map((d) => t(`report.dim.${d}`)),
    ]),
  ].slice(0, 3);
  const advice = [
    ...new Set([
      ...(reading.report.doDont?.do ?? []),
      ...reading.report.sections.flatMap((s) =>
        s.blocks.flatMap((b) => (b.type === 'advice' ? b.items : [])),
      ),
    ]),
  ];
  return (
    <div
      ref={root}
      className="print-report"
      data-print-theme={theme}
      data-system={reading.system}
      data-locale={locale}
      data-layout={layout}
      data-ready="false"
      style={{ width: layout === 'pdf' ? undefined : width }}
    >
      <div data-sheet-template hidden>
        <section className="print-sheet-template">
          <div className="print-page-inner">
            <header className="print-header">
              <span>{t('common.brandTitle', { nameZh: brand.nameZh, nameEn: brand.nameEn })}</span>
              <span>{t(`nav.${reading.system}`)}</span>
            </header>
            <div className="print-page-template-content" />
            <footer className="print-footer">
              <span>{t('report.disclaimer.short')}</span>
              <span data-page-number />
            </footer>
          </div>
        </section>
      </div>
      <div className="print-source">
        <section data-print-section="cover">
          <div className="print-cover" data-print-block>
            <p className="print-kicker">{t('export.edition')}</p>
            <div className="print-brand-zh">{t('brand.nameZh', { name: brand.nameZh })}</div>
            <div className="print-brand-en">{t('brand.nameEn', { name: brand.nameEn })}</div>
            <h1>{t(`nav.${reading.system}`)}</h1>
            <p className="print-persona">{text(reading.report.headline.persona)}</p>
            <div className="print-keywords">
              {keywords.map((k) => (
                <span key={k}>{text(k)}</span>
              ))}
            </div>
            <svg
              viewBox="0 0 360 350"
              className="print-radar"
              role="img"
              aria-label={t('report.radar')}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <polygon
                  key={n}
                  points={dims.map((_, i) => point(i, n * 20)).join(' ')}
                  fill="none"
                  stroke="var(--line-2)"
                />
              ))}
              <polygon
                points={dims
                  .map((d, i) => point(i, reading.report.headline.scores[d] * 20))
                  .join(' ')}
                fill="var(--accent-glow)"
                stroke="var(--gold)"
                strokeWidth="2"
              />
              {dims.map((d, i) => {
                const [x, y] = point(i, 140).split(',');
                return (
                  <text key={d} x={x} y={y} textAnchor="middle" fill="var(--text-2)" fontSize="12">
                    {t(`report.dim.${d}`)} {reading.report.headline.scores[d]}/5
                  </text>
                );
              })}
            </svg>
            <div className="print-cover-bottom">
              <div>
                {reading.birthYear ? (
                  <p>
                    {t('report.birthYear', { year: reading.birthYear })}
                    {zodiac ? ` · ${zodiac}` : ''}
                  </p>
                ) : null}
                <p>
                  {t('export.generated', {
                    date: new Intl.DateTimeFormat(locale, {
                      dateStyle: 'long',
                      timeZone: 'UTC',
                    }).format(new Date(reading.createdAt)),
                  })}
                </p>
                <p className="print-domain">{text(brand.domain)}</p>
              </div>
              <img src={qr} width="90" height="90" alt={t('export.qr')} />
            </div>
          </div>
        </section>
        <section data-print-section="chart">
          <h2 data-print-block>{t('report.chart')}</h2>
          <div className="print-chart" data-print-block>
            <PrintChart chart={reading.chart} />
          </div>
          <aside className="print-legend" data-print-block>
            {t(`export.legend.${reading.system}`)}
          </aside>
        </section>
        {reading.report.sections.map((section, i) => (
          <section key={section.key} data-print-section={section.key}>
            <div className="print-chapter-heading" data-print-block>
              <p className="print-kicker">
                {t('export.chapter', { number: String(i + 1).padStart(2, '0') })}
              </p>
              <h2>{text(section.title)}</h2>
              <p className="print-lead">{text(section.lead)}</p>
            </div>
            {section.blocks.map((block, j) => {
              if (block.type === 'paragraph' || block.type === 'transition')
                return (
                  <p key={j} data-print-block>
                    {text(block.text)}
                  </p>
                );
              if (block.type === 'advice')
                return block.items.map((item, k) => (
                  <aside className="print-advice" key={`${j}-${k}`} data-print-block>
                    <strong>{t('report.advice')}</strong>
                    <p>{text(item)}</p>
                  </aside>
                ));
              if (block.type === 'evidence')
                return (
                  <div className="print-evidence" key={j} data-print-block>
                    <strong>{t('report.evidence')}</strong>
                    {block.items.map((item, k) => (
                      <span key={k}>{text(`${item.label}: ${item.value}`)}</span>
                    ))}
                  </div>
                );
              if (block.type === 'sources')
                return block.items.map((source, k) => (
                  <div className="print-footnote" key={`${j}-${k}`} data-print-block>
                    <strong>
                      {t('report.sources')} {k + 1}
                    </strong>
                    <blockquote>
                      {text(source.text)}
                      <cite>{text(source.from)}</cite>
                    </blockquote>
                  </div>
                ));
              return null;
            })}
          </section>
        ))}
        <section data-print-section="actions">
          <h2 data-print-block>{t('report.actions')}</h2>
          <p className="print-lead" data-print-block>
            {text(reading.report.headline.persona)}
          </p>
          {advice.map((item, i) => (
            <div className="print-action" key={i} data-print-block>
              <span className="print-checkbox" />
              {text(item)}
            </div>
          ))}
          {reading.report.doDont?.dont.map((item, i) => (
            <p key={i} data-print-block>
              {t('report.dont')} · {text(item)}
            </p>
          ))}
        </section>
        <section data-print-section="legal">
          <div className="print-end-qr" data-print-block>
            <img src={qr} width="120" height="120" alt={t('export.qr')} />
            <p>{text(brand.domain)}</p>
          </div>
          <h2 className="print-legal-heading" data-print-block>
            {t('export.appendix')}
          </h2>
          <p className="print-disclaimer" data-print-block>
            {t('legal.disclaimer.full')}
          </p>
          <h3 data-print-block>{t('report.school')}</h3>
          {Object.entries(reading.meta.schoolUsed).map(([key, value]) => (
            <p className="print-parameter" key={key} data-print-block>
              <code>{text(key)}</code>
              <code>{text(String(value))}</code>
            </p>
          ))}
          <p className="print-footnote" data-print-block>
            {t('export.versions', {
              engine: reading.report.engineVersion,
              knowledge: reading.report.knowledgeVersion,
              interpret: reading.report.interpretVersion,
            })}
          </p>
        </section>
      </div>
      <div className="print-pages" />
    </div>
  );
}
