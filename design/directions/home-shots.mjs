// Captures the homepage states at 1440 and 390 for review (board/home/).
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal','--enable-gpu'] });
const shots = [
  ['ask-thermal','?heat=0'],['ask-isotherm','?heat=1'],['ask-vents','?heat=2'],
  ['working','?state=working'],['answer','?state=answer'],['error-net','?state=error-net'],['error-server','?state=error-server'],
];
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport:{ width:w, height: w>500 ? 900 : 844 }, deviceScaleFactor:1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  for (const [name, q] of shots) {
    if (only && !name.startsWith(only)) continue;
    await p.goto(`file://${here}/home.html${q}${q?'&':'?'}review=0`); await p.waitForTimeout(2200);
    await p.screenshot({ path:`${here}/board/home/${name}-${w}.jpg`, quality:82 });
    if (name==='ask-thermal') await p.screenshot({ path:`${here}/board/home/full-${w}.jpg`, quality:70, fullPage:true });
    if (name==='answer') await p.screenshot({ path:`${here}/board/home/answer-full-${w}.jpg`, quality:75, fullPage:true });
  }
  const ox = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(w, 'overflow', ox, 'errors', errs.filter(e=>!/favicon|ERR_/.test(e)));
  await p.close();
}
await b.close();
