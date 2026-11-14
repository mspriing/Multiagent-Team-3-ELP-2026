// Labelled comparison board for the four fluted looks: desktop row, phone row, then working and answer per look.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), d = `${here}/board/r3b`;
const L = [[2,'C as sent','what you picked'],[3,'C1 Thermal','a thermal-camera heat body in crisp bands'],[4,'C2 Vents','hot cracks glowing through the warm ground'],[5,'C3 Plumes','heat rising in columns']];
const img = f => `data:image/jpeg;base64,${fs.readFileSync(`${d}/${f}`).toString('base64')}`;
const col = ([h,t,s]) => `<div class="c"><h2>${t}</h2><p>${s}</p>
  <img src="${img(`ask-h${h}-1440.jpg`)}"><div class="row"><img class="ph" src="${img(`ask-h${h}-390.jpg`)}"><img class="ph" src="${img(`working-h${h}-390.jpg`)}"><img class="ph" src="${img(`answer-h${h}-390.jpg`)}"></div>
  <img src="${img(`working-h${h}-1440.jpg`)}"><img src="${img(`answer-h${h}-1440.jpg`)}"></div>`;
const html = `<html><head><style>body{margin:0;background:#1F2029;color:#FCFFFF;font-family:Geist,-apple-system,sans-serif;padding:48px;width:${4*720+3*32}px}
.g{display:grid;grid-template-columns:repeat(4,720px);gap:32px}.c img{width:720px;display:block;border-radius:10px;margin-top:14px}
.row{display:flex;gap:12px}.row img.ph{width:232px}h1{font-size:44px;margin:0 0 8px}h2{font-size:30px;margin:0}p{margin:6px 0 0;color:#b9bcc8;font-size:20px}.top{margin-bottom:32px}</style></head>
<body><div class="top"><h1>Fluted heat: three more geothermal versions</h1><p>Each column: home desktop, then phone (home, working, answer), then desktop working and answer.</p></div><div class="g">${L.map(col).join('')}</div></body></html>`;
fs.writeFileSync(`${d}/board.html`, html);
const b = await chromium.launch({ channel:'chrome', headless:true });
const p = await b.newPage({ viewport:{ width:4*720+3*32+96, height:900 }, deviceScaleFactor:1 });
await p.goto(`file://${d}/board.html`); await p.waitForTimeout(500);
await p.screenshot({ path:`${d}/pick-geo.jpg`, quality:82, fullPage:true }); await b.close(); console.log('ok');
