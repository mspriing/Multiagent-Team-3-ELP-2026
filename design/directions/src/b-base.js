/* Shared page wiring for the B rebuild. Each option sets window.FX_STATES before this runs and marks its
   elements with data-fill / data-act; this file fills them and drives the light. */
const $ = id => document.getElementById(id);
const all = sel => [...document.querySelectorAll(sel)];
const ICONS = { Supervisor:'compass', Researcher:'magnifying-glass', Analyst:'chart-bar', Writer:'pen-nib' };
for (const el of all('[data-crew]')) el.innerHTML = AGENTS.map(a => `<div class="tile"><i class="ic ph-fill ph-${ICONS[a[0]]}" aria-hidden="true"></i><div class="tx"><b>${a[0]}</b><span>${a[1]}</span></div></div>`).join('');
for (const el of all('[data-sugs]')) el.innerHTML = SUGGESTIONS.map(s => `<button type="button" class="chip">${esc(s)}</button>`).join('');

let light, last = null, tick = null;
const flow = createFlow(render);
const fxCanvas = $('fx');
if (fxCanvas) createLight(fxCanvas, fxFor(FX_STATES, 'ask')).then(l => { light = l; if (last) render(last, true); });

function render(s, force) {
  const prev = last ? last.state : null; last = s; document.body.dataset.state = s.state;
  if ($('q').value !== s.question) $('q').value = s.question;
  for (const b of all('[data-act=send]')) b.disabled = !s.question.trim();
  if (prev !== s.state || force) { if (light) light.to(fxFor(FX_STATES, s.state), 1400); }
  for (const el of all('[data-fill=question]')) el.textContent = s.question;
  clearInterval(tick);
  if (s.state === 'working') { const up = () => all('[data-fill=clock]').forEach(el => el.textContent = fmtTime(performance.now() - s.startedAt)); up(); tick = setInterval(up, 250); }
  if (s.state === 'answer') {
    const html = renderMarkdown(s.answer, { skipSources: true }).html;
    all('[data-fill=doc]').forEach(el => el.innerHTML = html);
    const links = sourcesFrom(s.answer).map(x => `<a class="src" href="${x.url}" target="_blank" rel="noopener"><span>${x.host}</span><b>${esc(x.title)}</b></a>`).join('');
    all('[data-fill=srcs]').forEach(el => el.innerHTML = links);
  }
  if (s.state === 'error') {
    all('[data-fill=err-title]').forEach(el => el.textContent = ERRORS[s.error].title);
    all('[data-fill=err-body]').forEach(el => el.textContent = ERRORS[s.error].body);
  }
  const on = s.copied && Date.now() - s.copied < 2200; $('toast').classList.toggle('on', !!on);
  if (on && s.copied <= Date.now()) setTimeout(() => render(flow.get()), 2300);
}
$('q').addEventListener('input', e => flow.type(e.target.value));
$('q').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); flow.send(); } });
$('form').addEventListener('submit', e => { e.preventDefault(); flow.send(); });
document.addEventListener('click', e => {
  const chip = e.target.closest('.chip'); if (chip) { flow.type(chip.textContent); $('q').focus(); return; }
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  if (act === 'new') { flow.reset(); setTimeout(() => $('q').focus(), 300); }
  if (act === 'copy') flow.copy();
  if (act === 'retry') flow.send();
  if (act === 'edit') { flow.edit(); setTimeout(() => $('q').focus(), 300); }
});
