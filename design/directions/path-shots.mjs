// Scroll-position captures of the pinned path section, plus a click test of the whole flow.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal'] });
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport:{ width:w, height: w>500?900:844 } });
  await p.goto(`file://${here}/home.html?review=0`); await p.waitForTimeout(800);
  const top = await p.evaluate(() => document.getElementById('path').offsetTop);
  const steps = w>500 ? [0, .3, .6, .95] : [0, .5, 1];
  for (const [i, f] of steps.entries()) { await p.evaluate(y => scrollTo(0, y), top + f * (w>500 ? 900*1.4 : 1400)); await p.waitForTimeout(900); await p.screenshot({ path:`${here}/board/home/path-${i}-${w}.jpg`, quality:78 }); }
  // click test
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  const log = [];
  await p.click('.chip >> nth=1'); log.push('chip->q: ' + (await p.inputValue('#q')));
  await p.click('[data-act=send]'); await p.waitForTimeout(400); log.push('state ' + await p.evaluate(() => document.body.dataset.state));
  await p.waitForTimeout(3000); log.push('fill ' + await p.evaluate(() => getComputedStyle(document.getElementById('run')).getPropertyValue('--p')));
  await p.screenshot({ path:`${here}/board/home/fill-mid-${w}.jpg`, quality:78 });
  await p.waitForTimeout(4600); log.push('state ' + await p.evaluate(() => document.body.dataset.state) + ' sources ' + await p.locator('.platter').count() + ' cites ' + await p.locator('a.cite').count());
  await p.click('[data-act=copy]'); await p.waitForTimeout(300); log.push('toast ' + await p.evaluate(() => document.getElementById('toast').classList.contains('on')));
  await p.click('[data-act=new]'); await p.waitForTimeout(400); log.push('new -> ' + await p.evaluate(() => document.body.dataset.state));
  await p.goto(`file://${here}/home.html?review=0&fail=net`); await p.waitForTimeout(500);
  await p.click('.chip >> nth=2'); await p.click('[data-act=send]'); await p.waitForTimeout(7600);
  log.push('fail net -> ' + await p.evaluate(() => document.body.dataset.state) + ' / ' + await p.textContent('.alert h2'));
  await p.click('[data-act=edit]'); await p.waitForTimeout(400); log.push('edit -> ' + await p.evaluate(() => document.body.dataset.state) + ' q kept ' + !!(await p.inputValue('#q')));
  await p.click('[data-act=ask] >> nth=0'); log.push('nav ask ok');
  const ox = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(w, log.join(' | '), 'overflow', ox);
  await p.close();
}
await b.close();
