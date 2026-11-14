// Clicks every control in each direction and checks the state that follows.
import { chromium } from '/Users/michaelspring/.npm-global/lib/node_modules/playwright/index.mjs';
import path from 'path'; import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu','--use-angle=metal'] });
const results = [];
const SEL = {
  'a-stage': { sugs: '#tries button', input: '#q', send: '#send', copy: '#copy', newQ: '#newSheet' },
  'b-window': { sugs: '#sugs button', input: '#q', send: '#send', copy: '#copy', newQ: '#newAns' },
  'c-brief': { sugs: '#chips button', input: '#q', send: '#send', copy: '#copy', newQ: '#newQ' },
};
for (const d of Object.keys(SEL)) {
  const s = SEL[d], check = (name, ok) => results.push(`${ok ? 'PASS' : 'FAIL'} ${d}: ${name}`);
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  const state = () => p.evaluate(() => document.body.dataset.state);
  await p.goto(`file://${here}/${d}.html`); await p.waitForTimeout(600);
  check('Send disabled when empty', await p.isDisabled(s.send));
  await p.locator(s.sugs).nth(1).click(); await p.waitForTimeout(200);
  check('suggestion fills the box', (await p.inputValue(s.input)).includes('chip supply'));
  check('Send enabled after typing', !(await p.isDisabled(s.send)));
  await p.fill(s.input, ''); await p.type(s.input, 'Test question'); await p.press(s.input, 'Enter'); await p.waitForTimeout(300);
  check('Enter sends (working)', (await state()) === 'working');
  await p.waitForTimeout(7200);
  check('answer arrives', (await state()) === 'answer');
  await p.click(s.copy); await p.waitForTimeout(300);
  const clip = await p.evaluate(() => navigator.clipboard.readText()).catch(() => '');
  check('Copy answer copies the Markdown', clip.includes('Short answer'));
  const toastVisible = await p.evaluate(() => { const t = document.getElementById('toast') || document.getElementById('mCopied'); return t && getComputedStyle(t).visibility !== 'hidden' && getComputedStyle(t).display !== 'none'; });
  check('copied confirmation shows', !!toastVisible);
  const link = await p.locator('a[href^="https://"]').first().getAttribute('target');
  check('source links open in a new tab', link === '_blank');
  await p.waitForTimeout(2500);
  await p.click(s.newQ); await p.waitForTimeout(500);
  check('New question returns to Ask and clears', (await state()) === 'ask' && (await p.inputValue(s.input)) === '');
  await p.goto(`file://${here}/${d}.html?fail=net`); await p.waitForTimeout(400);
  await p.fill(s.input, 'Fail please'); await p.click(s.send); await p.waitForTimeout(7300);
  check('network error shows', (await state()) === 'error');
  await p.click('#retry'); await p.waitForTimeout(300);
  check('Try again re-sends', (await state()) === 'working');
  await p.waitForTimeout(7300); await p.click('#edit'); await p.waitForTimeout(300);
  check('Edit question keeps the question', (await state()) === 'ask' && (await p.inputValue(s.input)) === 'Fail please');
  check('no page errors', errs.length === 0);
  await ctx.close();
}
await b.close(); console.log(results.join('\n'));
