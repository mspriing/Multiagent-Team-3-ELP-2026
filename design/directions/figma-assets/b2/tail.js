const SPECS = P
  ? [['P01 Ask', 'ask'], ['P02 Ask typed', 'ask', { typed: true }], ['P03 Working', 'working', { timer: '0:02' }], ['P03b Working', 'working', { timer: '0:15' }], ['P04 Answer', 'answer'], ['P04b Answer copied', 'answer', { toast: true }], ["P05 Error can't connect", 'error', { err: 'net' }]]
  : [['01 Ask', 'ask'], ['02 Ask typed', 'ask', { typed: true }], ['03a Working', 'working', { timer: '0:02' }], ['03b Working', 'working', { timer: '0:15' }], ['04 Answer', 'answer'], ['05 Answer copied', 'answer', { toast: true }], ["06 Error can't connect", 'error', { err: 'net' }], ['07 Error agents failed', 'error', { err: 'server' }]];
const sec = figma.createSection(); sec.name = P ? 'Phone 390' : 'Desktop 1440';
sec.x = 0; sec.y = P ? 1400 : 0;
const out = {}; let maxH = 0;
for (const [i, [name, state, extra]] of SPECS.entries()) {
  const f = await frame({ name, state, ...(extra || {}) });
  sec.appendChild(f); f.x = 60 + i * (M.W + 100); f.y = 80; maxH = Math.max(maxH, f.height);
  out[name] = f.id;
}
sec.resizeWithoutConstraints(60 + SPECS.length * (M.W + 100), maxH + 160);
return out;
