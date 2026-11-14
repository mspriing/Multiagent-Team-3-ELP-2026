// Measures every visible element of each screen of home.html (look 6) and writes a layer list for the Figma builder.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), page = path.resolve(here, '../home.html');
const S = ['ask','typed','working','answer','copied','error-net','error-server'];
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal','--enable-gpu'] });
for (const w of [1440, 390]) {
  const p = await b.newPage({ viewport:{ width:w, height: w>500 ? 900 : 844 }, deviceScaleFactor:1 });
  for (const st of S) {
    await p.goto(`file://${page}?state=${st}&heat=6&ans=a&review=0`); await p.waitForTimeout(2600);
    const data = await p.evaluate(() => {
      const W = innerWidth, H = innerHeight, out = [];
      const rgba = s => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [v[0]/255, v[1]/255, v[2]/255, v.length > 3 ? v[3] : 1]; };
      const vis = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity === 0) return false; } return true; };
      const onScreen = r => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < W && r.top < H;
      const clipped = el => { const r = el.getBoundingClientRect(); for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const c = getComputedStyle(e); if (c.overflow !== 'visible' || c.overflowX !== 'visible' || c.overflowY !== 'visible') { const q = e.getBoundingClientRect(); if (r.bottom <= q.top + .5 || r.top >= q.bottom - .5 || r.right <= q.left + .5 || r.left >= q.right - .5) return true; } } return false; };
      const iconName = el => { const m = [...el.classList].find(c => c.startsWith('ph-') && c !== 'ph-fill'); return m ? m.slice(3) : null; };
      const all = [...document.body.querySelectorAll('*')].filter(el => !el.closest('canvas,.review,script,style,svg') && vis(el));
      const textDone = new Set();
      for (const el of all) {
        const r = el.getBoundingClientRect(); if (!onScreen(r) || clipped(el)) continue;
        const c = getComputedStyle(el);
        if (el.tagName === 'I' && iconName(el)) { out.push({ k:'icon', name:iconName(el), x:r.x, y:r.y, w:r.width, h:r.height, color:rgba(c.color), glyph:parseFloat(c.fontSize), bg:rgba(c.backgroundColor), radius:parseFloat(c.borderTopLeftRadius)||0 }); continue; }
        const bg = rgba(c.backgroundColor), blur = (c.backdropFilter.match(/blur\(([\d.]+)px/) || [])[1];
        const bw = parseFloat(c.borderTopWidth) || 0, bc = rgba(c.borderTopColor);
        let shadow = null; const sm = c.boxShadow !== 'none' && c.boxShadow.match(/rgba?\([^)]+\)\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px(?:\s+(-?[\d.]+)px)?/);
        if (sm) shadow = { color:rgba(c.boxShadow), x:+sm[1], y:+sm[2], blur:+sm[3], spread:+(sm[4]||0) };
        const hasBox = (bg && bg[3] > 0.005) || blur || (bw > 0 && bc && bc[3] > 0) || shadow;
        if (hasBox) {
          const t = c.transform !== 'none' ? 1 : 0;
          out.push({ k:'box', tag:el.tagName.toLowerCase(), cls:el.className && el.className.baseVal === undefined ? el.className : '', x:r.x, y:r.y, w:r.width, h:r.height,
            bg, blur: blur ? +blur : 0, radius: Math.min(parseFloat(c.borderTopLeftRadius) || 0, r.height / 2, r.width / 2), border: bw > 0 ? { w:bw, c:bc } : null, shadow, op:+c.opacity });
        }
        if (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /text|search/.test(el.type))) {
          const val = el.value, ph = el.placeholder, txt = val || ph; if (txt) {
            const pc = val ? c : getComputedStyle(el, '::placeholder'); const pl = parseFloat(c.paddingLeft)||0, pt = parseFloat(c.paddingTop)||0, pr = parseFloat(c.paddingRight)||0;
            const lh = parseFloat(c.lineHeight) || parseFloat(c.fontSize)*1.4, cw = r.width - pl - pr;
            const probe = document.createElement('div'); probe.style.cssText = `position:absolute;visibility:hidden;width:${cw}px;font:${c.fontWeight} ${c.fontSize}/${c.lineHeight} ${c.fontFamily};letter-spacing:${c.letterSpacing};white-space:pre-wrap`; probe.textContent = txt; document.body.appendChild(probe); const th = probe.getBoundingClientRect().height; probe.remove();
            out.push({ k:'text', text:txt, ranges:[], x:r.x + pl, y:r.y + pt, w:cw, h:th, multi: th > lh * 1.4, size:parseFloat(c.fontSize), weight:+c.fontWeight, lh, ls:parseFloat(c.letterSpacing)||0, color:rgba(pc.color), align:'LEFT', tag:'textarea' });
          } continue; }
        // text: an element that owns a non-empty direct text node and is not inside an element already taken as text
        if ([...el.parentElement ? [el] : []].length && !textDone.has(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) {
          // climb to the nearest block-ish ancestor whose inline content includes this text (a paragraph with inline links)
          let host = el; while (host.parentElement && ['inline'].includes(getComputedStyle(host).display) && !textDone.has(host.parentElement)) host = host.parentElement;
          if (textDone.has(host)) continue;
          const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); let str = '', ranges = [], node, breaks = [], curTop = null;
          const hc = getComputedStyle(host); const hlh = parseFloat(hc.lineHeight) || parseFloat(hc.fontSize) * 1.2;
          while ((node = walker.nextNode())) {
            const pe = node.parentElement; if (pe.closest('i[class*=ph-]')) continue; const pc = getComputedStyle(pe); if (pc.display === 'none') continue;
            const raw = node.textContent, start = str.length;
            for (let j = 0; j < raw.length; j++) {
              const ch = /\s/.test(raw[j]) ? ' ' : raw[j];
              if (ch === ' ' && (!str || str.endsWith(' '))) continue;
              if (ch !== ' ') { const rg = document.createRange(); rg.setStart(node, j); rg.setEnd(node, j + 1); const q = rg.getClientRects()[0];
                if (q) { if (curTop !== null && q.top > curTop + hlh * .5) breaks.push(str.length); if (curTop === null || q.top > curTop + hlh * .5) curTop = q.top; } }
              str += ch;
            }
            if (str.length === start) continue;
            const badge = pe !== host && rgba(pc.backgroundColor) && rgba(pc.backgroundColor)[3] > .5 && pc.display !== 'block';
            ranges.push({ s:start, e:str.length, color:rgba(pc.color), weight:+pc.fontWeight, size:parseFloat(pc.fontSize), u: pc.textDecorationLine.includes('underline') ? rgba(pc.textDecorationColor) : null, badge });
          }
          // put the browser's own line breaks into the string so Figma wraps the same way
          for (const k of breaks.reverse()) {
            if (str[k - 1] === ' ') str = str.slice(0, k - 1) + '\n' + str.slice(k);
            else { str = str.slice(0, k) + '\n' + str.slice(k); for (const q of ranges) { if (q.s >= k) q.s++; if (q.e >= k) q.e++; } }
          }
          str = str.replace(/ +$/, ''); if (!str) continue;
          for (const d of host.querySelectorAll('*')) textDone.add(d); textDone.add(host);
          let rr = null; { const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); let tn; while ((tn = tw.nextNode())) { if (!tn.textContent.trim() || tn.parentElement.closest('i[class*=ph-]')) continue; const rg = document.createRange(); rg.selectNodeContents(tn); for (const q of rg.getClientRects()) { if (!q.width) continue; rr = rr ? { x:Math.min(rr.x,q.x), y:Math.min(rr.y,q.y), r:Math.max(rr.r,q.right), b:Math.max(rr.b,q.bottom) } : { x:q.x, y:q.y, r:q.right, b:q.bottom }; } } }
          if (!rr) continue; rr.width = rr.r - rr.x; rr.height = rr.b - rr.y;
          if (host.tagName === 'LI' && getComputedStyle(host).listStyleType === 'disc') { const fs = parseFloat(getComputedStyle(host).fontSize); out.push({ k:'dot', x: host.getBoundingClientRect().x - fs * .95, y: rr.y + (parseFloat(getComputedStyle(host).lineHeight) || fs*1.5) / 2 - 2.5, d:5, color:rgba(getComputedStyle(host).color) }); }
          const lh = parseFloat(hc.lineHeight) || parseFloat(hc.fontSize) * 1.2;
          const multi = rr.height > lh * 1.4;
          const hr = host.getBoundingClientRect(), pl = parseFloat(hc.paddingLeft) || 0, pr = parseFloat(hc.paddingRight) || 0;
          out.push({ k:'text', text:str, ranges, x: rr.x, y: rr.y, w: rr.width, h: rr.height, multi,
            size:parseFloat(hc.fontSize), weight:+hc.fontWeight, lh, ls:parseFloat(hc.letterSpacing) || 0, color:rgba(hc.color), align: hc.textAlign === 'center' ? 'CENTER' : hc.textAlign === 'right' || hc.textAlign === 'end' ? 'RIGHT' : 'LEFT', tag:host.tagName.toLowerCase() });
        }
      }
      const hf = heatFor(visual);
      return { W, H, heat:{ heat:hf.E, speed:hf.S, calm:hf.Q, hot:{ x:hf.hx*100, y:(1-hf.hy)*100 }, hot2:{ x:hf.h2x*100, y:(1-hf.h2y)*100 }, cool:{ x:hf.cx*100, y:(1-hf.cy)*100 }, coolStrength:hf.cz }, layers: out };
    });
    data.name = `${st}-${w}`;
    fs.writeFileSync(`${here}/${st}-${w}.json`, JSON.stringify(data));
    console.log(st, w, data.layers.length, 'layers', JSON.stringify(data).length, 'bytes');
  }
  await p.close();
}
await b.close();
