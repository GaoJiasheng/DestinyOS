'use client';
import { useEffect, useState, useTransition } from 'react';
import { useCopy } from '@/i18n/use-copy';
import { Button } from '@/components/ui/button';
import { validateKuAction, saveKuDraftAction, previewKuAction } from '@/app/admin/actions';
import type { previewKu, validateKu } from '@/lib/admin-knowledge';
/** Live editorial previews render escaped content, never YAML-provided HTML. */
export function KnowledgeEditor({
  unitId,
  initialYaml,
  initialVersion,
}: {
  unitId: string;
  initialYaml: string;
  initialVersion: number;
}) {
  const t = useCopy();
  const [yaml, setYaml] = useState(initialYaml),
    [version, setVersion] = useState(initialVersion),
    [fixture, setFixture] = useState('A');
  const [validation, setValidation] = useState<Awaited<ReturnType<typeof validateKu>> | null>(null);
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewKu>> | null>(null);
  const [pending, start] = useTransition(),
    [message, setMessage] = useState('');
  useEffect(() => {
    let alive = true;
    setValidation(null);
    const timer = setTimeout(() => {
      void validateKuAction(yaml).then((result) => {
        if (alive && result.ok) setValidation(result.data);
      });
    }, 400);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [yaml]);
  const unit = validation?.valid ? validation.unit : undefined;
  return (
    <div>
      <p>{t('admin.ku.version', { version })}</p>
      <div className="admin-editor-grid">
        <div>
          <label htmlFor="yaml">{t('admin.ku.yaml')}</label>
          <textarea
            id="yaml"
            className="admin-yaml"
            value={yaml}
            onChange={(event) => {
              setYaml(event.target.value);
              setPreview(null);
              setMessage('');
            }}
            maxLength={100000}
            spellCheck={false}
          />
        </div>
        <div>
          <h2>{t('admin.ku.preview')}</h2>
          {(['zh', 'en'] as const).map((locale) => (
            <article className="admin-panel" key={locale} lang={locale}>
              <h3>{t(`me.language.${locale}`)}</h3>
              {unit && (
                <>
                  <h4>{t('admin.content', { text: unit[locale].title })}</h4>
                  <p>{t('admin.content', { text: unit[locale].summary })}</p>
                  <p>{t('admin.content', { text: unit[locale].body })}</p>
                </>
              )}
            </article>
          ))}
        </div>
      </div>
      <section
        aria-live="polite"
        className="admin-diagnostics"
        tabIndex={0}
        aria-label={t('admin.ku.validation')}
      >
        <h2>{t('admin.ku.validation')}</h2>
        {!validation ? (
          <p>{t('admin.pending')}</p>
        ) : validation.valid ? (
          <p>{t('admin.ku.valid')}</p>
        ) : (
          <ul>
            {validation.diagnostics.map((d, i) => (
              <li key={i}>
                {t('admin.ku.diagnostic', { line: d.line, column: d.column, message: d.message })}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Button
        disabled={pending || !validation?.valid}
        onClick={() =>
          start(async () => {
            const result = await saveKuDraftAction(yaml, unitId, version);
            if (result.ok) {
              setVersion(result.data.version);
              setYaml(result.data.yaml);
              setMessage(t('admin.saved'));
            } else setMessage(t('admin.error', { code: result.code }));
          })
        }
      >
        {t('admin.ku.saveDraft')}
      </Button>
      <label htmlFor="fixture">{t('admin.ku.fixture')}</label>
      <select id="fixture" value={fixture} onChange={(event) => setFixture(event.target.value)}>
        {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((item) => (
          <option key={item} value={item}>
            {t('admin.ku.fixtureName', { fixture: item })}
          </option>
        ))}
      </select>
      <Button
        disabled={pending || !validation?.valid}
        onClick={() =>
          start(async () => {
            const result = await previewKuAction(yaml, fixture);
            if (result.ok) {
              setPreview(result.data);
              setMessage('');
            } else
              setMessage(
                result.code === 'E_REQUIRES_BIRTH_TIME'
                  ? t('engine.errors.E_REQUIRES_BIRTH_TIME')
                  : t('admin.error', { code: result.code }),
              );
          })
        }
      >
        {t('admin.ku.previewFixture')}
      </Button>
      <p role="status">{pending ? t('admin.pending') : message}</p>
      {preview && (
        <div className="admin-editor-grid">
          {preview.previews.map((item) => (
            <article
              className="admin-panel admin-preview"
              key={item.locale}
              lang={item.locale}
              tabIndex={0}
              aria-label={t('admin.ku.preview')}
            >
              <h2>{t(`me.language.${item.locale}`)}</h2>
              <p role="status">{t(item.matched ? 'admin.ku.matched' : 'admin.ku.notMatched')}</p>
              {item.report.sections.map((section) => (
                <section key={section.key}>
                  <h3>{t('admin.content', { text: section.title })}</h3>
                  {section.blocks.flatMap((block, i) =>
                    block.type === 'paragraph'
                      ? [
                          <p
                            key={i}
                            data-unit-id={block.unitId}
                            className={block.unitId === unitId ? 'admin-matched' : undefined}
                          >
                            {t('admin.content', { text: block.text })}
                          </p>,
                        ]
                      : [],
                  )}
                </section>
              ))}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
