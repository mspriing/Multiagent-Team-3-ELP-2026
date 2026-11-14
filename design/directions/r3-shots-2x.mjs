// Round 3 captures: every state at 1440 and 390, the three heat readings, both answer layouts (board/r3/2x/).
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const only = process.argv[2];
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal','--enable-gpu'] });
const shots = [
  ['ask-defined','?heat=0'],['ask-smooth','?heat=1'],['ask-fluted','?heat=2'],['typed','?state=typed'],
  ['working','?state=working'],['answer-sections','?state=answer&ans=a'],['answer-report','?state=answer&ans=b'],['copied','?state=copied&ans=a'],
  ['error-net','?state=error-net'],['error-server','?state=error-server'],
];
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport:{ width:w, height: w>500 ? 900 : 844 }, deviceScaleFactor:2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  for (const [name, q] of shots) {
    if (only && !name.startsWith(only)) continue;
    await p.goto(`file://${here}/home.html${q}&review=0`); await p.waitForTimeout(2600);
    await p.screenshot({ path:`${here}/board/r3/2x/${name}-${w}.jpg`, quality:88 });
    if (name==='ask-defined') await p.screenshot({ path:`${here}/board/r3/2x/full-${w}.jpg`, quality:70, fullPage:true });
    if (name.startsWith('answer')) await p.screenshot({ path:`${here}/board/r3/2x/${name}-full-${w}.jpg`, quality:75, fullPage:true });
  }
  // How it works, mid-scroll (second agent lit)
  if (!only || only==='how') { await p.goto(`file://${here}/home.html?review=0`); await p.waitForTimeout(800);
    const y = await p.evaluate(() => { const r = document.getElementById('howpin'); return r.offsetTop + (r.offsetHeight - innerHeight) * .35; });
    await p.evaluate(y => { document.documentElement.style.scrollBehavior='auto'; scrollTo(0, y); }, y); await p.waitForTimeout(1500);
    await p.screenshot({ path:`${here}/board/r3/2x/how-${w}.jpg`, quality:88 }); }
  const ox = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(w, 'overflow', ox, 'errors', errs.filter(e=>!/favicon|ERR_/.test(e)));
  await p.close();
}
await b.close();
