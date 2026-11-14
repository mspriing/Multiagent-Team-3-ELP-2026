import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import { fileURLToPath } from 'url'; import path from 'path';
const here = path.dirname(fileURLToPath(import.meta.url));
const jobs = [['ask',1440,900],['run',1440,900],['answer',1440,900],['error',1440,900],['ask',390,844],['run',390,844],['answer',390,844],['error',390,844]];
const b = await chromium.launch({ channel: 'chrome' });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
for (const [mode,w,h] of jobs){
  await p.goto(`file://${here}/texture.html?w=${w}&h=${h}&mode=${mode}&flute=${w<500?8:11}`);
  await p.waitForFunction(() => document.title === 'done', null, { timeout: 120000 });
  const data = await p.evaluate(() => document.getElementById('c').toDataURL('image/png'));
  const fs = await import('fs'); fs.writeFileSync(`${here}/../textures/${mode}-${w}.png`, Buffer.from(data.split(',')[1],'base64'));
  console.log('wrote', mode, w);
}
await b.close();
