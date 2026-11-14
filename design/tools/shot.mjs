import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const [,, paramsFile, outPrefix, w='1440', h='900', times='0'] = process.argv;
const params = fs.readFileSync(paramsFile, 'utf8');
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-angle=metal','--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
for (const t of times.split(',')) {
  await p.goto(`file://${here}/shader.html?w=${w}&h=${h}&t=${t}&p=${encodeURIComponent(params)}`);
  await p.waitForFunction(() => document.title !== '', null, { timeout: 30000 });
  const title = await p.title(); if (title !== 'done') { console.log(title); break; }
  await p.screenshot({ path: `${outPrefix}-t${t}.png` }); console.log('ok', t);
}
await b.close();
