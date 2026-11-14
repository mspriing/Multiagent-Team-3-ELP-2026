// Window-only stills of direction B (panel and source cards hidden) to sit under the live shader in Figma.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(`${here}/figma-assets`, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu','--use-angle=metal'] });
for (const [w, h, states] of [[1440, 900, ['ask', 'working', 'answer', 'error-net']], [390, 844, ['ask', 'working', 'error-net']]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  for (const st of states) {
    await p.goto(`file://${here}/b-window.html?state=${st}`); await p.waitForTimeout(1600);
    await p.addStyleTag({ content: '.srcs{display:none!important}' });
    await p.waitForTimeout(200);
    await p.locator('.window').screenshot({ path: `${here}/figma-assets/window-${st}-${w}.png` });
  }
  await p.close();
}
await b.close(); console.log(fs.readdirSync(`${here}/figma-assets`).join('\n'));
