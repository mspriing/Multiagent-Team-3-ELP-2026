// Conversation screens: every state at 1440 and 390, 2x, plus overflow and console checks (board/r4/).
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)); fs.mkdirSync(`${here}/board/r4`, { recursive:true });
const D = [['new-list','view=new'],['new-empty','view=new&sb=empty'],['thread','view=thread&scroll=bottom'],['sources','view=thread&src=1&scroll=src'],['followup','view=thread&follow=working&scroll=bottom'],['loading','view=loading'],['missing','view=missing'],['thread-closed','view=thread&sb=closed&scroll=bottom']];
const M = [['drawer','view=thread&drawer=1&scroll=bottom'],['drawer-empty','view=new&sb=empty&drawer=1'],['thread','view=thread&scroll=bottom'],['sources','view=thread&src=1&scroll=src'],['followup','view=thread&follow=working&scroll=bottom'],['loading','view=loading'],['missing','view=missing']];
const only = process.argv[2];
const b = await chromium.launch({ channel:'chrome', headless:true, args:['--use-angle=metal','--enable-gpu'] });
for (const [w, list] of [[1440, D], [390, M]]) {
  const p = await b.newPage({ viewport:{ width:w, height: w>500 ? 900 : 844 }, deviceScaleFactor:2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type()==='error' && !/favicon|ERR_/.test(m.text()) && errs.push(m.text()));
  for (const [n, q] of list) { if (only && !n.startsWith(only)) continue;
    await p.goto(`file://${here}/app.html?${q}`); await p.waitForTimeout(2600);
    await p.screenshot({ path:`${here}/board/r4/${n}-${w}.png` }); }
  const ox = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(w, 'overflow', ox, 'errors', errs); await p.close();
}
await b.close();
