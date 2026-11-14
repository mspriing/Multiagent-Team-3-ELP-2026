// Measures B2 Band per state and size, and captures light-only stills of the band for the Figma frames.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--enable-unsafe-webgpu','--enable-features=Vulkan,WebGPU','--use-angle=metal'] });
const out = {};
const SEL = ['.band','.brand','.hero h1','.hero .lead','.qwrap','.qcard','#q','.qcard .chips','.chip','.qrow','.hint','[data-act=send]','.clock','.wq','.crew','.tile','.ansq h1','.ansq .btns','.ansq button','.cards','.cards .card','.doc h2','.doc p','.doc ul','.doc li','.side-card .src','.side-card h2','.err h1','.errcard','.errcard p','.errcard button'];
for (const [w,h] of [[1440,900],[390,844]]) {
  const p = await b.newPage({ viewport:{width:w,height:h}, deviceScaleFactor:2 });
  for (const st of ['ask','typed','working','answer','error-net','error-server']) {
    await p.goto(`file://${here}/b2-band.html?state=${st}`); await p.waitForTimeout(st==='answer'?1900:1700);
    const m = await p.evaluate(SEL => { const r = {}; for (const s of SEL) r[s] = [...document.querySelectorAll(s)].filter(e => e.offsetParent || e.tagName==='BODY').map(e => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { x:Math.round(b.x), y:Math.round(b.y+scrollY), w:Math.round(b.width), h:Math.round(b.height), fs:cs.fontSize, lh:cs.lineHeight, fw:cs.fontWeight, ls:cs.letterSpacing, text:(e.innerText||'').slice(0,400) }; }); r.docH = document.documentElement.scrollHeight; return r; }, SEL);
    out[`${st}-${w}`] = m;
    // light-only still of the band
    await p.locator('.band').screenshot({ path:`${here}/figma-assets/b2/band-${st}-${w}.png`, style:'.band > :not(.fx){visibility:hidden!important}' });
  }
  await p.close();
}
await b.close();
fs.writeFileSync(`${here}/b2-measure.json`, JSON.stringify(out, null, 1));
console.log('ok');
