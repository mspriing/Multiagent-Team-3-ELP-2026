// Round 3c: the fluted Isotherm on every state, 2x, for Figma (board/r3c/).
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const S = ['ask','typed','working','answer','copied','error-net','error-server'];
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal','--enable-gpu'] });
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport:{ width:w, height: w>500 ? 900 : 844 }, deviceScaleFactor:2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  for (const st of S) { await p.goto(`file://${here}/home.html?state=${st}&heat=6&ans=a&review=0`); await p.waitForTimeout(3000);
    await p.screenshot({ path:`${here}/board/r3c/${st}-${w}.png` }); }
  const ox = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(w, 'overflow', ox, 'errors', errs); await p.close();
}
await b.close();
