'use client';
import { toast } from 'sonner';
import { useCopy } from '@/i18n/use-copy';
import { designTokens } from '@/lib/design-tokens';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { TermChip } from './ui/term-chip';
/** Show every documented design token and interactive examples in each system theme. */
export function TokenGallery() {
  const t = useCopy();
  const colors = {
    ...designTokens.base,
    ...Object.fromEntries(
      Object.entries(designTokens.extra).filter(
        ([, value]) => value.startsWith('#') || value.startsWith('rgba'),
      ),
    ),
  };
  return (
    <>
      <section className="tokens-section">
        <h2 className="type-h2">{t('dev.tokens.colors')}</h2>
        <div className="token-grid">
          {Object.entries(colors).map(([name, value]) => (
            <Card key={name}>
              <div className="token-swatch" style={{ background: `var(--${name})` }} />
              <code className="token-name">{t('dev.tokens.value', { value: `--${name}` })}</code>
              <code className="token-name">{t('dev.tokens.value', { value })}</code>
            </Card>
          ))}
        </div>
      </section>
      <section className="tokens-section">
        <h2 className="type-h2">{t('dev.tokens.components')}</h2>
        <div className="theme-grid">
          {(['east', 'west', 'vedic'] as const).map((theme) => (
            <div className="theme-sample" data-theme={theme} key={theme}>
              <h3 className="type-h2">{t(`nav.theme.${theme}`)}</h3>
              <div className="theme-buttons">
                <Button onClick={() => toast(t('dev.tokens.toastMessage'))}>
                  {t('dev.tokens.primary')}
                </Button>
                <Button variant="secondary">{t('dev.tokens.secondary')}</Button>
                <Button variant="ghost">{t('dev.tokens.ghost')}</Button>
              </div>
              <Card>
                <h4 className="type-h3">{t('dev.tokens.cardTitle')}</h4>
                <p className="muted type-small">{t('dev.tokens.cardBody')}</p>
                <div>
                  <TermChip />
                </div>
              </Card>
              <div className="token-grid">
                {Object.entries(designTokens[theme]).map(([name, value]) => (
                  <div key={name}>
                    <div className="token-swatch" style={{ background: `var(--${name})` }} />
                    <code className="token-name">
                      {t('dev.tokens.value', { value: `--${name}` })}
                    </code>
                    <code className="token-name">{t('dev.tokens.value', { value })}</code>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <section className="tokens-section">
        <h2 className="type-h2">{t('dev.tokens.typography')}</h2>
        {(['display', 'h1', 'h2', 'h3', 'body', 'small', 'caption', 'ganzhi'] as const).map(
          (size) => (
            <div className="type-sample" key={size}>
              <code className="token-name">
                {t('dev.tokens.value', { value: `--size-${size}` })}
              </code>
              <p className={`type-${size}`}>{t('dev.tokens.sampleZh')}</p>
              <p className={`type-${size}`} lang="en">
                {t('dev.tokens.sampleEn')}
              </p>
            </div>
          ),
        )}
        <TokenList tokens={designTokens.typography} />
      </section>
      <section className="tokens-section">
        <h2 className="type-h2">{t('dev.tokens.spacing')}</h2>
        <div className="token-list">
          {Object.entries(designTokens.spacing).map(([name, value]) => (
            <div key={name}>
              <code className="token-name">
                {t('dev.tokens.value', { value: `--${name}: ${value}` })}
              </code>
              <span className="spacing-bar" style={{ width: `var(--${name})` }} />
            </div>
          ))}
        </div>
      </section>
      <section className="tokens-section">
        <h2 className="type-h2">{t('dev.tokens.radii')}</h2>
        <div className="token-list">
          {Object.entries(designTokens.radii).map(([name, value]) => (
            <div key={name}>
              <code className="token-name">
                {t('dev.tokens.value', { value: `--${name}: ${value}` })}
              </code>
              <div className="radius-sample" style={{ borderRadius: `var(--${name})` }} />
            </div>
          ))}
        </div>
      </section>
      <section className="tokens-section">
        <h2 className="type-h2">{t('dev.tokens.motion')}</h2>
        <TokenList tokens={{ ...designTokens.motion, ...designTokens.extra }} />
        <div className="glow-sample" style={{ boxShadow: 'var(--glow-gold)' }} />
        <div className="glow-sample" style={{ boxShadow: 'var(--glow-accent)' }} />
        <Button onClick={() => toast(t('dev.tokens.toastMessage'))}>{t('dev.tokens.toast')}</Button>
      </section>
    </>
  );
}
/** Render translated technical token names and values without assuming a display language. */
function TokenList({ tokens }: { tokens: Record<string, string> }) {
  const t = useCopy();
  return (
    <div className="token-list">
      {Object.entries(tokens).map(([name, value]) => (
        <div key={name}>
          <code className="token-name">{t('dev.tokens.value', { value: `--${name}` })}</code>
          <code className="token-name">{t('dev.tokens.value', { value })}</code>
        </div>
      ))}
    </div>
  );
}
