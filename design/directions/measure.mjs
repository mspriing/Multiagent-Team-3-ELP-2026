// Dumps geometry and type of the key elements in direction B for each state, so Figma matches the HTML.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu','--use-angle=metal'] });
const out = {};
for (const [w, h] of [[1440, 900], [390, 844]]) for (const st of ['ask', 'typed', 'working', 'answer', 'copied', 'error-net', 'error-server']) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(`file://${here}/b-window.html?state=${st}`); await p.waitForTimeout(1500);
  out[`${st}-${w}`] = await p.evaluate(() => {
    const pick = sel => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => {
      const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
      return { sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, fw: cs.fontWeight, lh: cs.lineHeight, ls: cs.letterSpacing, color: cs.color, bg: cs.backgroundColor, text: (e.innerText || '').slice(0, 60) };
    });
    return ['.panel', '.window', '.brand', '#newTop', '.view.on h1', '.view.on h2', '.view.on .lead', '.box', '#q', '.hint', '#send', '.sugs button', '#workQ', '#clock', '.lbl', '.crew div', '.acts button', '.doc h2', '.doc p', '.doc li', '.srcs', '.srcs a', '#toast', '.err .row button', '.stream span', '.phone-srcs a'].flatMap(pick);
  });
  await p.close();
}
await b.close();
fs.writeFileSync(`${here}/b-measure.json`, JSON.stringify(out, null, 1)); console.log('ok', Object.keys(out).length);
