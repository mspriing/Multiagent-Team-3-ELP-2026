// Whole homepage, top to bottom, flattened (pinned How it works laid out with the second agent lit), at 1440 and 390, 2x.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal','--enable-gpu'] });
for (const st of ['home','answer','copied']) for (const w of [1440, 390]) {
  const H = w > 500 ? 900 : 844;
  const p = await b.newPage({ viewport:{ width:w, height:H }, deviceScaleFactor:2 });
  await p.goto(`file://${here}/home.html?heat=6&ans=a&review=0${st === 'home' ? '' : '&state=' + st}`); await p.waitForTimeout(2800);
  await p.addStyleTag({ content:`.howpin{height:auto!important}.howstage{position:static!important}.heat{position:absolute!important;height:${H}px!important}.toast{position:absolute!important;top:${H-72}px!important;bottom:auto!important}` });
  await p.evaluate(() => document.querySelectorAll('#agentlist .ag').forEach((s,i)=>s.classList.toggle('on', i===1)));
  await p.waitForTimeout(900);
  if (st !== 'home') { // answer pages: the heat is fixed behind the whole scroll, so cover the full length
    await p.addStyleTag({ content:'.heat{position:fixed!important;height:100%!important}' });
    const fh = await p.evaluate(() => document.documentElement.scrollHeight); await p.setViewportSize({ width:w, height:fh });
    await p.evaluate(() => dispatchEvent(new Event('resize'))); await p.waitForTimeout(2600);
  }
  await p.screenshot({ path:`${here}/board/r3c/${st === 'home' ? 'full' : 'full-' + st}-${w}.png`, fullPage:true });
  console.log(w, await p.evaluate(() => document.documentElement.scrollHeight));
  await p.close();
}
await b.close();
