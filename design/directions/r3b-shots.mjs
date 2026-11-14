// Round 3b: the fluted geothermal variants (C as sent, C1 Thermal, C2 Vents, C3 Plumes) on the real page.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const states = (process.argv[2] || 'ask').split(',');
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal','--enable-gpu'] });
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport:{ width:w, height: w>500 ? 900 : 844 }, deviceScaleFactor:1 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && errs.push(m.text()));
  for (const st of states) for (const h of (process.argv[3]||"2,6").split(",").map(Number)) {
    await p.goto(`file://${here}/home.html?state=${st}&heat=${h}&ans=a&review=0`); await p.waitForTimeout(2800);
    await p.screenshot({ path:`${here}/board/r3b/${st}-h${h}-${w}.jpg`, quality:86 });
  }
  console.log(w, 'errors', errs.filter(e=>!/favicon|ERR_/.test(e)));
  await p.close();
}
await b.close();
