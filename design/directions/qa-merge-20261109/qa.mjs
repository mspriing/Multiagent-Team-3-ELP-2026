import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
const OUT = process.argv[2]; const URL0 = 'http://localhost:5173/';
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu'] });
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'http://localhost:5173' });
  const p = await ctx.newPage(); const errs = [];
  p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && !/favicon|ERR_|Failed to load resource|Error (sending|opening|loading)/.test(m.text()) && errs.push(m.text()));
  const shot = n => p.screenshot({ path: `${OUT}/${n}-${w}.png` });
  const overflow = () => p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const ph = w < 768;
  await p.goto(URL0); await p.waitForTimeout(1500);
  await shot('01-new');
  check(`${w} empty sidebar text`, ph || await p.getByText('No saved conversations yet.').isVisible());
  // pick a suggestion and send
  await p.locator('.chip').first().click();
  check(`${w} chip fills box`, (await p.locator('#q-new').inputValue()).startsWith('Compare Microsoft'));
  await p.locator('#q-new').press('Enter'); await p.waitForTimeout(700);
  await shot('02-researching');
  check(`${w} busy label`, await p.locator('.send.busy').isVisible());
  await p.waitForSelector('.thread .turn', { timeout: 8000 }); await p.waitForTimeout(800);
  await shot('03-answer');
  check(`${w} cite badges`, (await p.locator('.cite').count()) >= 2, String(await p.locator('.cite').count()));
  check(`${w} sources section dropped from text`, !(await p.locator('.glabel', { hasText: /^Sources$/ }).count()));
  check(`${w} ledger count`, (await p.locator('.ledger summary').innerText()).includes('View sources (4)'), await p.locator('.ledger summary').innerText());
  check(`${w} sidebar lists convo`, (await p.locator('.convo').count()) >= 1);
  await p.locator('.cite').first().click(); await p.waitForTimeout(600);
  check(`${w} cite opens sources`, await p.locator('.ledger[open]').count() === 1);
  check(`${w} summary says Hide`, (await p.locator('.ledger summary').innerText()).includes('Hide sources'));
  await p.locator('.ledger').scrollIntoViewIfNeeded(); await shot('04-sources');
  await p.getByRole('button', { name: 'Copy answer' }).click(); await p.waitForTimeout(300);
  check(`${w} copy toast`, await p.locator('.toast.on').isVisible());
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  check(`${w} clipboard has answer`, clip.includes('Microsoft sells AI'));
  // follow-up
  await p.locator('#q-dock').fill('Which of these should a 200-person company act on first?');
  await p.locator('#q-dock').press('Enter'); await p.waitForTimeout(800);
  await shot('05-followup');
  check(`${w} working pill`, await p.getByText('Your AI agents are working...').first().isVisible());
  await p.waitForFunction(() => document.querySelectorAll('.thread .turn').length === 2 && !document.querySelector('.working'), null, { timeout: 8000 }); await p.waitForTimeout(600);
  check(`${w} two turns`, (await p.locator('.thread .turn').count()) === 2);
  check(`${w} dock cleared`, (await p.locator('#q-dock').inputValue()) === '');
  // failing follow-up
  await p.locator('#q-dock').fill('please fail now'); await p.locator('#q-dock').press('Enter');
  await p.waitForSelector('.alert', { timeout: 8000 }); await p.waitForTimeout(500);
  await shot('06-error-inline');
  check(`${w} server error text`, await p.getByText("The agents couldn't finish").isVisible());
  await p.getByRole('button', { name: 'Edit question' }).click(); await p.waitForTimeout(300);
  check(`${w} edit puts text back`, (await p.locator('#q-dock').inputValue()) === 'please fail now');
  check(`${w} alert gone after edit`, !(await p.locator('.alert').count()));
  // new chat, reopen saved conversation
  if (ph) { await p.locator('.nav .iconbtn').click(); await p.waitForTimeout(500); await shot('07-drawer'); check(`${w} drawer open`, await p.locator('.app.drawer').count() === 1); }
  await p.locator('.side .newchat').click(); await p.waitForTimeout(500);
  check(`${w} new chat view`, await p.locator('.newview h1').isVisible());
  check(`${w} drawer closes on new chat`, !ph || !(await p.locator('.app.drawer').count()));
  if (ph) { await p.locator('.nav .iconbtn').click(); await p.waitForTimeout(450); }
  await p.locator('.convo .open').first().click(); await p.waitForTimeout(250);
  await shot('08-loading');
  check(`${w} loading pill`, await p.getByText('Loading conversation...').isVisible());
  await p.waitForSelector('.thread .turn', { timeout: 5000 }); await p.waitForTimeout(400);
  check(`${w} reopened has 2 turns`, (await p.locator('.thread .turn').count()) === 2);
  check(`${w} active row`, await p.locator('.convo.on').count() === 1);
  if (ph) { await p.locator('.nav .iconbtn').click(); await p.waitForTimeout(450); await shot('09-drawer-active'); await p.keyboard.press('Escape'); await p.waitForTimeout(450); check(`${w} escape closes drawer`, !(await p.locator('.app.drawer').count())); }
  // close with x
  if (ph) { await p.locator('.nav .iconbtn').click(); await p.waitForTimeout(450); }
  await p.locator('.convo.on .x').click(); await p.waitForTimeout(300);
  check(`${w} x closes to new chat`, await p.locator('.newview').isVisible());
  // sidebar toggle on desktop
  if (!ph) { await p.locator('.nav .iconbtn').click(); await p.waitForTimeout(300); check(`${w} sidebar hides`, !(await p.locator('.side').isVisible())); await shot('10-sidebar-closed'); await p.locator('.nav .iconbtn').click(); await p.waitForTimeout(300); check(`${w} sidebar shows`, await p.locator('.side').isVisible()); }
  // missing conversation
  await p.route('**/conversations', r => r.fulfill({ json: [{ id: 'bad1', title: 'A conversation that was removed', created_at: '' }], headers: { 'access-control-allow-origin': '*' } }));
  await p.reload(); await p.waitForTimeout(1200);
  if (ph) { await p.locator('.nav .iconbtn').click(); await p.waitForTimeout(450); }
  await p.locator('.convo .open').first().click(); await p.waitForSelector('.alert', { timeout: 5000 }); await p.waitForTimeout(400);
  await shot('11-missing');
  check(`${w} missing alert`, await p.getByText("Couldn't load this conversation").isVisible());
  await p.getByRole('button', { name: 'New chat' }).last().click(); await p.waitForTimeout(300);
  check(`${w} missing -> new chat`, await p.locator('.newview').isVisible());
  // offline
  await p.route('**/chat', r => r.abort());
  await p.locator('#q-new').fill('Offline test question'); await p.locator('#q-new').press('Enter');
  await p.waitForSelector('.alert', { timeout: 5000 }); await p.waitForTimeout(500);
  await shot('12-offline');
  check(`${w} offline alert`, await p.getByText("Can't reach the research server").isVisible());
  // conversations list failure
  await p.route('**/conversations', r => r.abort()); await p.reload(); await p.waitForTimeout(1200);
  if (ph) { await p.locator('.nav .iconbtn').click(); await p.waitForTimeout(450); }
  check(`${w} list failure message`, await p.getByText("Couldn't load your conversations.").isVisible());
  await shot('13-list-failed');
  check(`${w} overflow`, (await overflow()) <= 0, String(await overflow()));
  check(`${w} console errors`, errs.length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}
await b.close();
console.log(results.join('\n'));
