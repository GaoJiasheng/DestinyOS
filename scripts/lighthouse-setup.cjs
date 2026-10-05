/* global module, localStorage */

module.exports = async (browser) => {
  const { readFileSync } = await import('node:fs');
  const page = await browser.newPage();
  await page.goto('http://localhost:38100/zh');
  await page.evaluate(
    (snapshot) => {
      localStorage.setItem('tianji-disclaimer-v1', 'accepted');
      localStorage.setItem('tianji.anon', snapshot);
    },
    readFileSync('/tmp/destiny-perf-fixture.json', 'utf8'),
  );
  // DESIGN-GAP: Fail setup if fixtures render an empty/error page; authenticated services are unnecessary for encrypted anonymous reports.
  for (const [path, selector] of [
    ['/zh/bazi/r/local/33333333-3333-4333-8333-333333333333', '#chart-root'],
    ['/zh/synastry/r/local/44444444-4444-4444-8444-444444444444', '.synastry-chart'],
    ['/zh/today/calendar', '[data-calendar-day]'],
  ]) {
    await page.goto(`http://localhost:38100${path}`);
    await page.waitForSelector(selector, { timeout: 120000 });
  }
  await page.close();
};
