// Records each direction running the real flow: cursor moves, typing, Send, the working state, the answer.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(`${here}/clips`, { recursive: true });
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu','--use-angle=metal'] });
for (const d of ['a-stage', 'b-window', 'c-brief']) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: `${here}/clips/tmp-${d}`, size: { width: 1440, height: 900 } } });
  const p = await ctx.newPage();
  await p.goto(`file://${here}/${d}.html`); await p.waitForTimeout(1500);
  for (let i = 0; i <= 20; i++) { await p.mouse.move(700 + i * 30, 200 + Math.sin(i / 3) * 120); await p.waitForTimeout(60); }
  await p.click('#q'); await p.keyboard.type("Compare Microsoft and Google's enterprise AI strategies", { delay: 28 });
  await p.waitForTimeout(500); await p.keyboard.press('Enter');
  await p.waitForTimeout(7600);
  await p.mouse.wheel(0, 500); await p.waitForTimeout(1200); await p.mouse.wheel(0, -500); await p.waitForTimeout(800);
  await p.click('#copy'); await p.waitForTimeout(2600);
  const vid = p.video(); await ctx.close();
  fs.renameSync(await vid.path(), `${here}/clips/${d}.webm`); fs.rmSync(`${here}/clips/tmp-${d}`, { recursive: true, force: true });
  console.log('clip', d);
}
await b.close();
