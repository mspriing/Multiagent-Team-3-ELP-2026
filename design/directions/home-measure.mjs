// Measures home.html (Isotherm band) for the Figma build and saves light-only band stills.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal'] });
const out = {};
const FLAT = '.pathpin{height:auto!important}.pathstage{position:static!important;height:auto!important;padding:clamp(4rem,3rem + 4vw,7rem) 0}.marquee .track{animation:none!important}';
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport:{ width:w, height: w>500?900:844 } });
  for (const st of ['ask','typed','working','answer','error-net','error-server']) {
    const q = st==='ask' ? '' : `&state=${st}`;
    await p.goto(`file://${here}/home.html?heat=1&review=0${q}`); await p.addStyleTag({ content: FLAT }); await p.waitForTimeout(2400);
    const m = await p.evaluate(() => {
      const r = el => { if (!el) return null; const b = el.getBoundingClientRect(); return { x:Math.round(b.x), y:Math.round(b.y+scrollY), w:Math.round(b.width), h:Math.round(b.height) }; };
      const q = s => r(document.querySelector(s));
      const all = s => [...document.querySelectorAll(s)].filter(e => e.offsetParent || e.getClientRects().length).map(r);
      return { page: document.documentElement.scrollHeight, nav:q('.nav'), band:q('.band'), bin:q('.bin'), hero:q('.hero'), h1:q('.hero h1, .ansq h1'), lead:q('.hero p'),
        qcard:q('.qcard'), chips:all('.qcard .chip'), send:q('.qcard .send'), run:q('.run'), sheet:q('.sheet'), alert:q('.alert'),
        marquee:q('.marquee'), agents:q('.s-agents'), agentCards:all('.agent'), path:q('.s-path'), track:q('#track4'), stations:all('.station'), cta:q('.s-cta'), foot:q('.foot'),
        platters:all('.platter'), doc:q('.sheet .doc'), acts:q('.acts') };
    });
    out[`${st}-${w}`] = m;
    await p.locator('.band').screenshot({ path:`${here}/figma-assets/home/band-${st}-${w}.png`, style:'.band > :not(.heat){visibility:hidden!important}' });
  }
  await p.close();
}
fs.writeFileSync(`${here}/home-measure.json`, JSON.stringify(out, null, 1));
await b.close(); console.log('ok');
