// Window stills of B with the Hairline relay: the light alone for the still layer (the figure is captured once, so it never doubles),
// and the figure alone on a transparent background to sit above the live light in Figma.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), out = `${here}/figma-assets/hairline`;
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu','--use-angle=metal'] });
// [name, state, wait ms]: "working" is just after Send (no branch lit yet), "working-lit" is a few seconds in.
const shots = { 1440: [['ask','ask',1600],['working','working',1500],['working-lit','working',4200],['answer','answer',1800],['error','error-net',1600]],
                390:  [['ask','ask',1600],['working','working',1500],['working-lit','working',4200],['error','error-net',1600]] };
const errors = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errors.push(String(e)));
  for (const [name, st, wait] of shots[w]) {
    await p.goto(`file://${here}/b-hairline.html?state=${st}`); await p.waitForTimeout(wait);
    await p.addStyleTag({ content: '.srcs{display:none!important}' });
    if (st !== 'answer') await p.locator('.window').screenshot({ path: `${out}/figure-${name}-${w}.png`, omitBackground: true, style: '.fx{visibility:hidden!important}.window,html,body{background:transparent!important}' });
    await p.locator('.window').screenshot({ path: `${out}/window-${name}-${w}.png`, style: '.fig{visibility:hidden!important}' });
  }
  await p.close();
}
await b.close(); console.log(errors.length ? errors.join('\n') : 'no page errors'); console.log(fs.readdirSync(out).join(' '));
