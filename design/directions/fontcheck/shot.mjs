import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu','--use-angle=metal'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
for (const k of ['clash','funnel','familjen']) { for (const st of ['ask','working']) { await p.goto(`file://${here}/b-${k}.html?state=${st}`); await p.waitForTimeout(1800); await p.screenshot({ path: `${here}/${k}-${st}.png` }); } }
await b.close();
