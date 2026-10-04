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
  await page.close();
};
