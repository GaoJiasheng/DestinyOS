// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { focusEvidence } from '../components/report/focus-evidence';
describe('focusEvidence', () => {
  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (run: FrameRequestCallback) => {
      run(0);
      return 0;
    });
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    Element.prototype.scrollIntoView = vi.fn();
  });
  it('opens the folded topic holding the target chart reference and focuses it', () => {
    document.body.innerHTML = `<div id="chart-root"><span data-chart-path="elements"></span></div>
      <section id="section-luck_timeline"><details class="section-fold">
      <button data-chart-path="luck.periods.3"></button></details></section>`;
    focusEvidence('luck.periods.3');
    const fold = document.querySelector<HTMLDetailsElement>('details.section-fold')!;
    expect(fold.open).toBe(true);
    expect(document.activeElement).toBe(
      document.querySelector('[data-chart-path="luck.periods.3"]'),
    );
  });
  it('prefers the main chart over a folded topic reference', () => {
    document.body.innerHTML = `<div id="chart-root"><button data-chart-path="elements.pct.wood"></button></div>
      <details class="section-fold"><button data-chart-path="elements.pct.wood"></button></details>`;
    focusEvidence('elements.pct.wood');
    expect(document.querySelector<HTMLDetailsElement>('details.section-fold')!.open).toBe(false);
    expect(document.activeElement?.closest('#chart-root')).not.toBeNull();
  });
});
