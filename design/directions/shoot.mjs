// Captures each state of each direction at 1440x900 and 390x844 with the live shader running.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [,, which = 'a-stage', statesArg = 'ask,typed,working,answer,copied,error-net'] = process.argv;
fs.mkdirSync(`${here}/shots`, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-angle=metal'] });
const errors = [];
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  p.on('pageerror', e => errors.push(String(e))); p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  for (const st of statesArg.split(',')) {
    await p.goto(`file://${here}/${which}.html?state=${st}`);
    await p.waitForTimeout(st === 'answer' || st === 'copied' ? 1800 : 1500);
    await p.screenshot({ path: `${here}/shots/${which}-${st}-${w}.png` });
  }
  await p.close();
}
await b.close();
console.log(errors.length ? 'ERRORS:\n' + [...new Set(errors)].join('\n') : 'no console errors');
