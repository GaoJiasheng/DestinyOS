import { SystemArt } from '@/components/art/system-art';
import { Link } from '@/i18n/navigation';
import { structuredJson } from '@/lib/learn';
import { faqJsonLd, landingCopy, landingLabels, type LandingSystem } from '@/lib/system-landing';
import './system-landing.css';

/** Pages whose tool sits on the same route expose it at this anchor. */
export const SYSTEM_TOOL_ANCHOR = 'system-tool';

type Props = { locale: string; system: LandingSystem };

function StartLink({ href, label }: { href: string; label: string }) {
  if (href.startsWith('#'))
    return (
      <a className="button button-primary" href={href}>
        {label}
      </a>
    );
  return (
    <Link className="button button-primary" href={href}>
      {label}
    </Link>
  );
}

function Intro({ locale, system }: Props) {
  const labels = landingLabels(locale);
  const copy = landingCopy(locale, system);
  return (
    <>
      <p className="system-landing-tagline">{copy.tagline}</p>
      {copy.background ? <p className="system-landing-background">{copy.background}</p> : null}
      <p className="system-landing-prepare">
        <strong>{labels.prepare}</strong> {copy.prepare}
      </p>
    </>
  );
}

/** First screen for pages where the tool is elsewhere (or below): the page's only h1. */
export function SystemLandingHero({ locale, system, startHref }: Props & { startHref: string }) {
  const labels = landingLabels(locale);
  const copy = landingCopy(locale, system);
  return (
    <header className="system-landing-hero">
      <SystemArt system={system} banner priority />
      <div className="system-landing-hero-copy">
        <h1 className="type-h1">{copy.name}</h1>
        <Intro locale={locale} system={system} />
        <StartLink href={startHref} label={labels.start} />
      </div>
    </header>
  );
}

/** Intro below a tool that already owns the h1, linking back up to it. */
export function SystemLandingBridge({ locale, system }: Props) {
  const labels = landingLabels(locale);
  const copy = landingCopy(locale, system);
  return (
    <section className="system-landing-bridge" aria-labelledby="landing-about">
      <h2 id="landing-about" className="type-h2">
        {labels.about.replace('{name}', copy.name)}
      </h2>
      <Intro locale={locale} system={system} />
      <StartLink href={`#${SYSTEM_TOOL_ANCHOR}`} label={labels.start} />
    </section>
  );
}

/** Server-rendered explanation sections; no client JS, FAQ uses native details. */
export function SystemLandingBody({ locale, system }: Props) {
  const labels = landingLabels(locale);
  const copy = landingCopy(locale, system);
  return (
    <div className="system-landing">
      <section aria-labelledby="landing-tells">
        <h2 id="landing-tells" className="type-h2">
          {labels.tells}
        </h2>
        <ul className="system-landing-grid">
          {copy.tells.map((item) => (
            <li key={item.title} className="card">
              <h3 className="type-h3">{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="landing-method">
        <h2 id="landing-method" className="type-h2">
          {labels.method}
        </h2>
        <ol className="system-landing-steps">
          {copy.method.map((item) => (
            <li key={item.title} className="card">
              <h3 className="type-h3">{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ol>
      </section>
      <section aria-labelledby="landing-sample">
        <h2 id="landing-sample" className="type-h2">
          {labels.sample} <span className="system-landing-badge">{labels.sampleBadge}</span>
        </h2>
        <p className="system-landing-note">{labels.sampleNote}</p>
        <figure className="card system-landing-sample">
          <dl className="system-landing-cells">
            {copy.sample.cells.map((cell) => (
              <div key={cell.label}>
                <dt>{cell.label}</dt>
                <dd>{cell.value}</dd>
              </div>
            ))}
          </dl>
          <figcaption>{copy.sample.caption}</figcaption>
          <ul className="system-landing-excerpts">
            {copy.sample.notes.map((note) => (
              <li key={note.chapter}>
                <h3 className="system-landing-chapter">{note.chapter}</h3>
                <p>{note.text}</p>
                <p className="system-landing-basis">
                  {labels.basis}: {note.basis}
                </p>
              </li>
            ))}
          </ul>
        </figure>
      </section>
      <section aria-labelledby="landing-faq">
        <h2 id="landing-faq" className="type-h2">
          {labels.faq}
        </h2>
        <div className="system-landing-faqs">
          {copy.faq.map((item) => (
            <details key={item.q} className="system-landing-faq">
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredJson(faqJsonLd(copy)) }}
        />
      </section>
      <nav aria-labelledby="landing-more">
        <h2 id="landing-more" className="type-h2">
          {labels.more}
        </h2>
        <ul className="system-landing-links">
          {copy.more.map((item) => (
            <li key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
