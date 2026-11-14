// Home (Isotherm) frame builder for use_figma. The caller prepends: const SIZE = 'desktop' | 'phone';
const P = SIZE === 'phone';
const page = await figma.getNodeByIdAsync('35:34'); await figma.setCurrentPageAsync(page);
for (const s of ['Regular', 'Medium', 'SemiBold']) await figma.loadFontAsync({ family: 'Geist', style: s });
const VID = { deep: '15:64', mid: '15:65', white: '2:7', lime: '15:75', blue: '15:76', onAccent: '15:71', primary: '15:67', tint: '26:118', inkBody: '26:119', inkSecondary: '26:120', inkHint: '26:121', inkPlaceholder: '26:122', bandSecondary: '26:123', frost: '35:35', white16: '35:36', white12: '35:37', white10: '35:38', deep12: '35:39', inkLime: '35:40' };
const VAR = {}; for (const [k, id] of Object.entries(VID)) VAR[k] = await figma.variables.getVariableByIdAsync('VariableID:' + id);
const paint = k => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', VAR[k]);
const STY = {}; for (const s of await figma.getLocalTextStylesAsync()) STY[s.name.replace(/^(B2|Home)\//, '')] = s.id;
if (!STY['Hero']) throw new Error('missing styles');
let heroStyle = (await figma.getLocalTextStylesAsync()).find(s => s.name === 'Home/Hero');
if (!heroStyle) { heroStyle = figma.createTextStyle(); heroStyle.name = 'Home/Hero'; heroStyle.fontName = { family: 'Geist', style: 'SemiBold' }; heroStyle.fontSize = 76; heroStyle.lineHeight = { unit: 'PERCENT', value: 100 }; heroStyle.letterSpacing = { unit: 'PERCENT', value: -3.5 }; }
STY['Home hero'] = heroStyle.id;
const IC = { compass: '35:58', 'magnifying-glass': '35:61', 'chart-bar': '35:64', 'pen-nib': '35:67', 'arrow-right': '35:70', 'check-circle': '35:73', link: '35:76', copy: '35:79', 'plus-circle': '35:82', 'wifi-slash': '35:85', warning: '35:88', 'arrow-clockwise': '35:91', globe: '35:94', 'github-logo': '35:97', 'arrow-up': '35:100' };
const SHADER = '2d4c7d6e-2f45-4c15-8d54-d73330e4537d/00d240c746bb3b91e089dd4fc0233ed9af608329';
await figma.importShaderById(SHADER);
const K = { heat: '2479277377:866816204', steps: '2749202968:91252086', cool: '2817391737:243349778', speed: '2819734563:1538716866', coolStrength: '2973295810:3688976570', style: '3690253666:2931448088', hot: '4148040030:1496491354' };
const HEAT = {
  ask: { heat: .55, speed: .35, hot: { x: 50, y: 98 }, cool: { x: 50, y: 42 }, coolStrength: .7 },
  working: { heat: .7, speed: 1.1, hot: { x: 50, y: 5 }, cool: { x: 50, y: 50 }, coolStrength: .45 },
  answer: { heat: .5, speed: .3, hot: { x: 50, y: 100 }, cool: { x: 50, y: 45 }, coolStrength: .6 },
  error: { heat: 0, speed: .08, hot: { x: 50, y: 100 }, cool: { x: 50, y: 50 }, coolStrength: 0 },
};
const heatFill = st => { const v = { style: 1, steps: 9, ...HEAT[st] }; const props = {}; for (const [n, k] of Object.entries(K)) props[k] = v[n]; return { type: 'SHADER', id: SHADER, properties: props }; };

const W = P ? 390 : 1440, VH = P ? 844 : 900, SIDE = P ? 20.56 : 96, INNER = W - 2 * SIDE;
const SECPAD = P ? 64 : 105.6, HEADGAP = P ? 32 : 51.2;
const STILLS = [], OUT = {};

async function text(str, style, color, o = {}) {
  const t = figma.createText(); await t.setTextStyleIdAsync(STY[style]);
  t.characters = str; t.fills = [paint(color)]; t.textAlignHorizontal = o.align || 'LEFT';
  if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, t.height); } else t.textAutoResize = 'WIDTH_AND_HEIGHT';
  if (o.name) t.name = o.name; return t;
}
function al(dir, o = {}) {
  const f = figma.createAutoLayout(dir); f.fills = o.fill ? [paint(o.fill)] : [];
  if (o.name) f.name = o.name;
  if (o.pad) { const [t, r, b, l] = o.pad; f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l; }
  if (o.gap != null) f.itemSpacing = o.gap; if (o.r != null) f.cornerRadius = o.r;
  if (o.align) f.counterAxisAlignItems = o.align; if (o.justify) f.primaryAxisAlignItems = o.justify;
  return f;
}
const put = (parent, node, x, y) => { parent.appendChild(node); node.x = x; node.y = y; return node; };
const fixW = (f, w) => { f.resize(w, f.height); f.counterAxisSizingMode = f.layoutMode === 'VERTICAL' ? 'FIXED' : f.counterAxisSizingMode; if (f.layoutMode === 'HORIZONTAL') f.primaryAxisSizingMode = 'FIXED'; };
async function icon(n, color, size) {
  const inst = (await figma.getNodeByIdAsync(IC[n])).createInstance(); inst.name = 'Icon/' + n;
  inst.rescale(size / 24); for (const v of inst.findAll(x => x.type === 'VECTOR')) v.fills = [paint(color)]; return inst;
}
async function pill(label, fill, color, o = {}) {
  const b = al('HORIZONTAL', { fill, pad: o.small ? [9.6, 17.6, 9.6, 17.6] : [13.6, 24, 13.6, 24], r: 999, gap: 8, align: 'CENTER', justify: 'CENTER', name: o.name || label });
  if (o.icon) b.appendChild(await icon(o.icon, color, o.small ? 17 : 18.4));
  b.appendChild(await text(label, o.small ? 'Button small' : 'Button', color));
  if (o.after) b.appendChild(await icon(o.after, color, 18.4));
  return b;
}
function base(name, h) { const f = figma.createFrame(); f.name = name; f.resize(W, h); f.fills = [paint('deep')]; f.clipsContent = true; return f; }
async function brand() {
  const b = al('HORIZONTAL', { gap: 11.2, align: 'CENTER', name: 'Brand' });
  const sq = al('HORIZONTAL', { fill: 'lime', r: 9, align: 'CENTER', justify: 'CENTER', name: 'Mark' }); sq.resize(32, 32); sq.primaryAxisSizingMode = 'FIXED'; sq.counterAxisSizingMode = 'FIXED';
  sq.appendChild(await icon('magnifying-glass', 'onAccent', 18.4)); b.appendChild(sq);
  b.appendChild(await text('Research Assistant', 'Button', 'primary')); return b;
}
async function nav(f, links, fillP = 0) {
  const n = al('VERTICAL', { fill: 'deep', name: 'Nav' }); put(f, n, 0, 0); fixW(n, W);
  const row = al('HORIZONTAL', { justify: 'SPACE_BETWEEN', align: 'CENTER', pad: [0, SIDE, 0, SIDE], name: 'Nav row' }); n.appendChild(row);
  row.layoutSizingHorizontal = 'FILL'; row.resize(W, 64); row.counterAxisSizingMode = 'FIXED';
  row.appendChild(await brand());
  if (links && !P) {
    const l = al('HORIZONTAL', { gap: 5.6, name: 'Links' }); row.appendChild(l); l.layoutPositioning = 'ABSOLUTE';
    for (const s of ['The agents', 'How it works']) { const a = al('HORIZONTAL', { pad: [8.8, 14.4, 8.8, 14.4], r: 999, name: s }); a.appendChild(await text(s, 'Nav link', 'primary')); l.appendChild(a); }
    l.x = (W - l.width) / 2; l.y = (64 - l.height) / 2;
  }
  row.appendChild(await pill('Ask a question', 'lime', 'onAccent', { small: true, name: 'Ask a question (nav)' }));
  const bar = figma.createFrame(); bar.name = 'Scroll fill (OXS)'; bar.resize(W, 4); bar.fills = [paint('mid')]; n.appendChild(bar);
  if (fillP > 0) { const s = figma.createRectangle(); s.name = 'Fill'; s.resize(W * fillP, 4); s.fills = [paint('lime')]; put(bar, s, 0, 0); }
  return n;
}
function band(f, h, st, still) {
  const b = figma.createFrame(); b.name = 'Band (heat field)'; b.resize(W, h); b.fills = [paint('deep')]; b.clipsContent = true; put(f, b, 0, 68);
  const r = figma.createRectangle(); r.name = 'Band still (Isotherm, from the prototype)'; r.resize(W, h); r.fills = [paint('deep')]; put(b, r, 0, 0);
  STILLS.push({ id: r.id, file: `band-${still}-${W}.png` });
  const live = figma.createRectangle(); live.name = 'effect background, Heat field (ELP isotherm heat, live)'; live.resize(W, h); live.fills = [heatFill(st)]; put(b, live, 0, 0);
  return b;
}
const Q = "Compare Microsoft and Google's enterprise AI strategies and identify opportunities a mid-sized software company should monitor.";
const SUGS = [Q, 'What is changing in AI chip supply?', 'How are universities using AI agents?'];
const AG = [['Supervisor', 'compass', 'Reads your question first and sends it to the Researcher.', 'Hands on', 'Your question, routed'], ['Researcher', 'magnifying-glass', 'Writes its own web searches and reads the results through Tavily.', 'Hands on', 'Notes from the web'], ['Analyst', 'chart-bar', 'Weighs what the sources say and pulls out the conclusions.', 'Hands on', 'The key findings'], ['Writer', 'pen-nib', 'Turns the findings into a clear answer and lists every source it used.', 'Hands back', 'Your answer and its sources']];
const SRCS = [['azure.microsoft.com', 'Azure OpenAI', 'https://azure.microsoft.com/products/ai-services/openai-service'], ['cloud.google.com', 'Vertex AI', 'https://cloud.google.com/vertex-ai'], ['microsoft.com', 'Microsoft 365 Copilot overview', 'https://www.microsoft.com/microsoft-365/copilot'], ['workspace.google.com', 'Gemini for Workspace', 'https://workspace.google.com/solutions/ai/']];
const SHADOW = [{ type: 'DROP_SHADOW', color: { r: .04, g: .043, b: .063, a: .55 }, offset: { x: 0, y: 30 }, radius: 60, spread: -30, visible: true, blendMode: 'NORMAL' }];

async function heroBlock(b, bandH) {
  const h = al('VERTICAL', { gap: P ? 19.2 : 19.2, align: 'CENTER', name: 'Hero' });
  h.appendChild(await text(P ? 'Ask a research\nquestion.\nGet an answer you\ncan check.' : 'Ask a research question.\nGet an answer you can check.', P ? 'Phone hero' : 'Home hero', 'primary', { align: 'CENTER' }));
  h.appendChild(await text('A Supervisor, a Researcher, an Analyst and a Writer work through it in turn, and every answer lists the sources it used.', P ? 'Phone lead' : 'Lead', 'primary', { align: 'CENTER', w: P ? 349 : 583 }));
  put(b, h, 0, P ? 123 : 180); h.x = (W - h.width) / 2;
}
async function qcard(f, typed) {
  const c = al('VERTICAL', { name: 'Question card', fill: 'white', r: 22, pad: [17.6, 17.6, 16, 17.6], gap: 14.4 }); c.effects = SHADOW;
  const w = P ? 349 : 768; put(f, c, (W - w) / 2, P ? 571 : 628); fixW(c, w);
  const box = al('HORIZONTAL', { name: 'Question box', pad: [5.6, 7.2, 5.6, 7.2] }); c.appendChild(box); box.layoutSizingHorizontal = 'FILL'; box.minHeight = P ? 60 : 69;
  const t = await text(typed ? Q : 'Ask a research question', P ? 'Phone input' : 'Input', typed ? 'onAccent' : 'inkPlaceholder', { w: 100 }); box.appendChild(t); t.layoutSizingHorizontal = 'FILL';
  const chips = al('HORIZONTAL', { name: 'Suggestions', gap: 8, pad: [0, 5.6, 0, 5.6] }); chips.layoutWrap = 'WRAP'; chips.counterAxisSpacing = 8; c.appendChild(chips); chips.layoutSizingHorizontal = 'FILL';
  for (const [i, s] of SUGS.entries()) {
    const ch = al('HORIZONTAL', { name: 'Suggestion', fill: 'tint', r: 999, pad: [8.8, 15.2, 8.8, 15.2] }); chips.appendChild(ch);
    const tt = await text(s, 'Chip', 'onAccent'); ch.appendChild(tt);
    if (i === 0) { const iw = w - 35.2 - 11.2; ch.resize(iw, ch.height); ch.layoutSizingHorizontal = 'FIXED'; tt.layoutSizingHorizontal = 'FILL'; tt.textAutoResize = 'HEIGHT'; ch.cornerRadius = 27; }
  }
  const row = al('HORIZONTAL', { name: 'Send row', justify: 'SPACE_BETWEEN', align: 'CENTER' }); c.appendChild(row); row.layoutSizingHorizontal = 'FILL';
  const hint = al('HORIZONTAL', { name: 'Hint', pad: [0, 0, 0, 7.2] }); hint.appendChild(await text('Press Enter to send', 'Caption', 'inkHint')); row.appendChild(hint);
  row.appendChild(await pill('Send', 'deep', 'primary', { after: 'arrow-right', name: 'Send' }));
  return c;
}
async function sectionHead(parent, title, body, dark) {
  const h = al('VERTICAL', { gap: 14.4, align: 'CENTER', name: 'Head' }); parent.appendChild(h); h.layoutSizingHorizontal = 'FILL';
  h.appendChild(await text(title, P ? 'Phone section title' : 'Section title', dark ? 'onAccent' : 'primary', { align: 'CENTER', w: INNER }));
  h.appendChild(await text(body, P ? 'Phone lead' : 'Lead', dark ? 'inkLime' : 'bandSecondary', { align: 'CENTER', w: P ? INNER : 590 }));
  return h;
}
function sec(name, fill, gap) { const s = al('VERTICAL', { name, fill, pad: [SECPAD, SIDE, SECPAD, SIDE], gap, align: 'CENTER' }); return s; }

async function buildHome(name) {
  const f = base(name, 4000);
  const b = band(f, P ? 591 : 648, 'ask', 'ask'); await heroBlock(b);
  await nav(f, true); const card = await qcard(f, false);
  const stack = al('VERTICAL', { name: 'Sections' }); put(f, stack, 0, P ? 967 : 978); fixW(stack, W);
  // Built with marquee
  const mq = figma.createFrame(); mq.name = 'Built with (moves on its own)'; mq.resize(W, 83.2); mq.fills = [paint('white')]; mq.clipsContent = true; stack.appendChild(mq);
  const tr = al('HORIZONTAL', { gap: 12, name: 'Track' }); put(mq, tr, -40, 22.4);
  for (const s of ['React', 'TypeScript', 'Vite', 'FastAPI', 'Python', 'LangGraph', 'DeepSeek', 'Tavily', 'React', 'TypeScript', 'Vite', 'FastAPI', 'Python', 'LangGraph']) { const p = al('HORIZONTAL', { fill: 'tint', r: 999, pad: [9.6, 18.4, 9.6, 18.4] }); p.appendChild(await text(s, 'Source title', 'onAccent')); tr.appendChild(p); }
  // The agents
  const sa = sec('The agents', 'mid', HEADGAP); stack.appendChild(sa); sa.layoutSizingHorizontal = 'FILL';
  await sectionHead(sa, 'Who works on your question', 'Each agent does one job, then hands its work to the next.');
  const grid = al(P ? 'VERTICAL' : 'HORIZONTAL', { gap: 16, name: 'Agent cards' }); sa.appendChild(grid); grid.layoutSizingHorizontal = 'FILL';
  for (const [n, ic, job, hl, hv] of AG) {
    const c = al('VERTICAL', { fill: 'white', r: 22, pad: [24, 24, 24, 24], gap: 11.2, name: 'Agent card/' + n }); grid.appendChild(c);
    const sq = al('HORIZONTAL', { fill: 'deep', r: 12, align: 'CENTER', justify: 'CENTER', name: 'Icon square' }); sq.resize(41.6, 41.6); sq.primaryAxisSizingMode = 'FIXED'; sq.counterAxisSizingMode = 'FIXED';
    sq.appendChild(await icon(ic, 'lime', 24.8)); c.appendChild(sq);
    c.appendChild(await text(n, 'Card heading', 'onAccent'));
    const p = await text(job, 'Card body', 'inkSecondary', { w: 100 }); c.appendChild(p); p.layoutSizingHorizontal = 'FILL';
    const hand = al('VERTICAL', { fill: 'tint', r: 14, pad: [12, 14.4, 12, 14.4], gap: 2.4, name: 'Hands on' }); c.appendChild(hand); hand.layoutSizingHorizontal = 'FILL';
    hand.appendChild(await text(hl, 'Tag', 'inkSecondary')); hand.appendChild(await text(hv, 'Source title', 'onAccent'));
    if (P) { c.layoutSizingHorizontal = 'FILL'; } else { c.layoutSizingHorizontal = 'FILL'; c.resize(c.width, 336); c.layoutSizingVertical = 'FIXED'; p.layoutGrow = 1; }
  }
  // Follow one question through
  const sp = sec('Follow one question through', 'deep', 25.6); stack.appendChild(sp); sp.layoutSizingHorizontal = 'FILL';
  await sectionHead(sp, 'Follow one question through', 'Scroll to move it from agent to agent. The same lime fill runs across the question box while yours is working.');
  const PP = .66;
  if (!P) {
    const track = figma.createFrame(); track.name = 'Path fill (scroll-driven, shown at 66%)'; track.resize(INNER, 57.6); track.cornerRadius = 999; track.fills = [paint('mid')]; track.clipsContent = true; sp.appendChild(track);
    const fl = figma.createRectangle(); fl.name = 'Fill'; fl.resize(INNER * PP, 57.6); fl.cornerRadius = 999; fl.fills = [paint('lime')]; put(track, fl, 0, 0);
    const cw = (INNER - 12.8 - 24) / 4;
    for (const [i, [n]] of AG.entries()) { const t = await text(n, 'Button', PP >= (i + .5) / 4 ? 'onAccent' : 'primary', { w: cw, align: 'CENTER' }); put(track, t, 6.4 + i * (cw + 8), (57.6 - t.height) / 2); }
  }
  const st = al(P ? 'VERTICAL' : 'HORIZONTAL', { gap: 16, name: 'Stations' }); sp.appendChild(st); st.layoutSizingHorizontal = 'FILL';
  const STN = [['Supervisor', 'Reads the question and sends it to the Researcher.', 'q'], ['Researcher', 'Writes its own web searches and reads the results through Tavily.', ['Microsoft enterprise AI strategy', 'Google Vertex AI enterprise adoption', 'AI opportunities for mid-sized software firms']], ['Analyst', 'Pulls the conclusions out of what the sources say.', 'list'], ['Writer', 'Turns the findings into one answer and lists every source.', 'ok']];
  for (const [i, [n, d, extra]] of STN.entries()) {
    const on = P || i <= 2;
    const c = al('VERTICAL', { fill: on ? 'white' : 'mid', r: 22, pad: [22.4, 22.4, 22.4, 22.4], gap: 12.8, name: `Station/${n}${on ? '' : ' (waiting)'}` }); st.appendChild(c); c.layoutSizingHorizontal = 'FILL';
    const ink = on ? 'onAccent' : 'primary', soft = on ? 'inkBody' : 'bandSecondary', box = on ? 'tint' : 'white10';
    c.appendChild(await text(n, 'Station heading', ink));
    const p = await text(d, 'Small body', soft, { w: 100 }); c.appendChild(p); p.layoutSizingHorizontal = 'FILL';
    if (extra === 'q') { const bx = al('VERTICAL', { fill: box, r: 12, pad: [11.2, 12.8, 11.2, 12.8] }); c.appendChild(bx); bx.layoutSizingHorizontal = 'FILL'; const t = await text(Q, 'Small body', soft, { w: 100 }); bx.appendChild(t); t.layoutSizingHorizontal = 'FILL'; }
    if (Array.isArray(extra)) for (const s of extra) { const bx = al('VERTICAL', { fill: box, r: 12, pad: [8.8, 12, 8.8, 12] }); c.appendChild(bx); bx.layoutSizingHorizontal = 'FILL'; const t = await text(s, 'Chip', ink, { w: 100 }); bx.appendChild(t); t.layoutSizingHorizontal = 'FILL'; }
    if (extra === 'list') { const t = await text('Microsoft sells AI inside seats companies already license.\nGoogle competes on model quality and price per use.\nBoth are adding agents that act inside other apps.', 'Small body', soft, { w: 100 }); c.appendChild(t); t.layoutSizingHorizontal = 'FILL'; t.setRangeListOptions(0, t.characters.length, { type: 'UNORDERED' }); t.paragraphSpacing = 5.6; }
    if (extra === 'ok') { const ok = al('HORIZONTAL', { fill: 'lime', r: 999, pad: [6.4, 12.8, 6.4, 12.8], gap: 6.4, align: 'CENTER', name: 'Answer ready' }); ok.appendChild(await icon('check-circle', 'onAccent', 14)); ok.appendChild(await text('Answer ready, 4 sources', 'Tag', 'onAccent')); c.appendChild(ok); }
    if (!P) { c.resize(c.width, Math.max(c.height, 272)); }
  }
  if (!P) { const hmax = Math.max(...st.children.map(c => c.height)); for (const c of st.children) { c.resize(c.width, c.height < 272 ? 272 : c.height); } st.counterAxisAlignItems = 'MIN'; }
  // CTA
  const sc = sec('Try it', 'lime', 16); stack.appendChild(sc); sc.layoutSizingHorizontal = 'FILL';
  sc.appendChild(await text('Try it with your own question', P ? 'Phone section title' : 'Section title', 'onAccent', { align: 'CENTER', w: INNER }));
  sc.appendChild(await text('Type anything you would normally research, and the agents will bring back an answer with its sources.', P ? 'Phone lead' : 'Lead', 'inkLime', { align: 'CENTER', w: P ? INNER : 420 }));
  const cw2 = al('HORIZONTAL', { pad: [16, 0, 0, 0], name: 'Action' }); sc.appendChild(cw2); cw2.appendChild(await pill('Ask a question', 'deep', 'primary', { after: 'arrow-up', name: 'Ask a question (CTA)' }));
  await footer(stack);
  f.resize(W, stack.y + stack.height);
  return f;
}
async function footer(parent) {
  const ft = al('VERTICAL', { name: 'Footer', fill: 'deep', pad: P ? [40, SIDE, 40, SIDE] : [60.8, SIDE, 60.8, SIDE], gap: 16, align: 'CENTER' }); parent.appendChild(ft); if (parent.layoutMode && parent.layoutMode !== 'NONE') ft.layoutSizingHorizontal = 'FILL'; else fixW(ft, W);
  ft.appendChild(await brand());
  ft.appendChild(await text("Built by Multi-Agent Team 3 in Nittany AI's ELP, Fall 2026.", 'Small body', 'bandSecondary', { align: 'CENTER' }));
  const row = al('HORIZONTAL', { gap: 8, name: 'Links' }); ft.appendChild(row);
  row.appendChild(await pill('View the code', 'white', 'onAccent', { small: true, icon: 'github-logo' }));
  row.appendChild(await pill('Back to top', 'white12', 'primary', { small: true }));
  return ft;
}
async function buildTyped(name) {
  const f = base(name, VH); const b = band(f, P ? 591 : 648, 'ask', 'typed'); await heroBlock(b); await nav(f, true); await qcard(f, true);
  return f;
}
async function runCard(fillP, clock, done) {
  const w = P ? 349 : 768;
  const r = figma.createFrame(); r.name = 'Question card, frosted and filling'; r.cornerRadius = 26; r.clipsContent = true; r.fills = [paint('frost')];
  r.effects = [{ type: 'BACKGROUND_BLUR', radius: 26, visible: true }, ...SHADOW];
  const content = async dark => {
    const ink = dark ? 'onAccent' : 'primary';
    const c = al('VERTICAL', { name: dark ? 'Content on the fill (dark type)' : 'Content on the frost (white type)', pad: Array(4).fill(P ? 22.4 : 38.4), gap: 17.6 }); fixW(c, w);
    const top = al('HORIZONTAL', { justify: 'SPACE_BETWEEN', align: 'CENTER', name: 'Top', gap: 16 }); c.appendChild(top); top.layoutSizingHorizontal = 'FILL';
    const lbl = await text(done ? 'Answer ready' : 'Working on your question', 'Label', ink, { w: P ? 150 : 400 }); top.appendChild(lbl);
    top.appendChild(await text(clock, P ? 'Phone run clock' : 'Run clock', ink, { name: 'Clock' }));
    const q = await text(Q, P ? 'Phone lead' : 'Lead', ink, { w: 100, name: 'Question' }); c.appendChild(q); q.layoutSizingHorizontal = 'FILL';
    const crew = al('HORIZONTAL', { gap: 8, name: 'Agents' }); crew.layoutWrap = 'WRAP'; crew.counterAxisSpacing = 8; c.appendChild(crew); crew.layoutSizingHorizontal = 'FILL';
    for (const [n, ic] of AG) {
      const p = al('HORIZONTAL', { fill: dark ? 'deep12' : 'white16', r: 999, pad: [7.2, 13.6, 7.2, 8], gap: 7.2, align: 'CENTER', name: n });
      const dot = al('HORIZONTAL', { fill: dark ? 'deep' : 'white', r: 999, align: 'CENTER', justify: 'CENTER' }); dot.resize(25.6, 25.6); dot.primaryAxisSizingMode = 'FIXED'; dot.counterAxisSizingMode = 'FIXED';
      dot.appendChild(await icon(ic, dark ? 'lime' : 'onAccent', 15.2)); p.appendChild(dot); p.appendChild(await text(n, 'Pill small', ink)); crew.appendChild(p);
    }
    return c;
  };
  const light = await content(false); put(r, light, 0, 0); r.resize(w, light.height);
  const fl = figma.createRectangle(); fl.name = `Lime fill (${Math.round(fillP * 100)}%)`; fl.resize(Math.max(.01, w * fillP), light.height); fl.fills = [paint('lime')]; put(r, fl, 0, 0);
  const clip = figma.createFrame(); clip.name = 'Fill clip'; clip.fills = []; clip.clipsContent = true; clip.resize(Math.max(.01, w * fillP), light.height); put(r, clip, 0, 0);
  const dark = await content(true); put(clip, dark, 0, 0);
  return r;
}
async function buildWorking(name, fillP, clock, done) {
  const f = base(name, VH); const bh = VH - 68; band(f, bh, 'working', 'working'); await nav(f, false);
  const r = await runCard(fillP, clock, done); put(f, r, (W - r.width) / 2, 68 + (bh - r.height) / 2); return f;
}
async function buildAnswer(name, toast) {
  const f = base(name, 3000); const bh = P ? 372 : 383; const b = band(f, bh, 'answer', 'answer'); await nav(f, false);
  const t = await text(P ? "Compare Microsoft and\nGoogle's enterprise\nAI strategies and\nidentify opportunities\na mid-sized software\ncompany should monitor." : "Compare Microsoft and Google's enterprise\nAI strategies and identify opportunities a\nmid-sized software company should monitor.", P ? 'Phone title' : 'Title', 'primary', { align: 'CENTER', name: 'Question' });
  put(b, t, (W - t.width) / 2, P ? 51 : 72);
  const sw = P ? 349 : 960, pad = P ? 23.8 : 44.8;
  const s = al('VERTICAL', { name: 'Answer sheet', fill: 'white', r: 30, pad: Array(4).fill(pad), gap: 0 }); s.effects = SHADOW; put(f, s, (W - sw) / 2, P ? 400 : 411); fixW(s, sw);
  const meta = al('HORIZONTAL', { gap: 8, justify: 'CENTER', name: 'Meta' }); meta.layoutWrap = 'WRAP'; meta.counterAxisSpacing = 8; s.appendChild(meta); meta.layoutSizingHorizontal = 'FILL';
  for (const [ic, label] of [['check-circle', 'Answered in 0:24'], ['link', '4 sources']]) { const m = al('HORIZONTAL', { fill: 'tint', r: 999, pad: [7.2, 14.4, 7.2, 14.4], gap: 6.4, align: 'CENTER' }); m.appendChild(await icon(ic, 'mid', 14)); m.appendChild(await text(label, 'Chip', 'onAccent')); meta.appendChild(m); }
  const doc = al('VERTICAL', { gap: 35.2, name: 'Answer', pad: [P ? 22.4 : 30.4, 0, 0, 0] }); s.appendChild(doc); doc.layoutSizingHorizontal = 'FILL';
  const part = async (h, body, list) => {
    const x = al('VERTICAL', { gap: 11.2, name: 'Section/' + h }); doc.appendChild(x); x.layoutSizingHorizontal = 'FILL';
    const ht = await text(h, P ? 'Phone section' : 'Section', 'onAccent', { w: 100 }); x.appendChild(ht); ht.layoutSizingHorizontal = 'FILL';
    const bt = await text(body, 'Body', 'inkBody', { w: 100 }); x.appendChild(bt); bt.layoutSizingHorizontal = 'FILL';
    if (list) { bt.setRangeListOptions(0, body.length, { type: 'UNORDERED' }); bt.paragraphSpacing = 6.4; } return bt;
  };
  const p1 = 'Microsoft sells AI through the products companies already pay for, with Copilot inside Microsoft 365 and Azure OpenAI 1 for custom builds. Google leans on its own Gemini models and Vertex AI 2, and pushes hardest with teams already on Google Cloud and Workspace.';
  const bt = await part('Short answer', p1);
  for (const [word, url] of [['Azure OpenAI', SRCS[0][2]], ['Vertex AI', SRCS[1][2]]]) { const i = p1.indexOf(word); bt.setRangeTextDecoration(i, i + word.length, 'UNDERLINE'); bt.setRangeHyperlink(i, i + word.length, { type: 'URL', value: url }); }
  for (const n of ['1', '2']) { const i = p1.indexOf(n === '1' ? 'OpenAI 1' : 'Vertex AI 2') + (n === '1' ? 7 : 10); await bt.setRangeTextStyleIdAsync(i, i + 1, STY['Cite']); bt.setRangeFills(i, i + 1, [paint('onAccent')]); bt.setRangeHyperlink(i, i + 1, { type: 'URL', value: SRCS[+n - 1][2] }); }
  await part('Where they differ', 'Microsoft bundles AI into seats companies already license, so adoption follows existing contracts.\nGoogle competes on model quality and price per use, backed by its own chips for training and serving.\nBoth are adding agents that act inside other apps, which is where new spending is moving.', true);
  await part('What a mid-sized software company should watch', 'Marketplace listings on Azure and Google Cloud, which decide how easily buyers can pay for your product.\nPrice changes for model use, which move the cost of every AI feature you ship.\nAgent standards for connecting apps, which decide whether their agents can use your product.', true);
  const acts = al('HORIZONTAL', { gap: 9.6, justify: 'CENTER', name: 'Actions', pad: [P ? 25.6 : 36.4, 0, 0, 0] }); acts.layoutWrap = 'WRAP'; acts.counterAxisSpacing = 9.6; s.appendChild(acts); acts.layoutSizingHorizontal = 'FILL';
  acts.appendChild(await pill('Copy answer', 'lime', 'onAccent', { icon: 'copy' })); acts.appendChild(await pill('New question', 'deep', 'primary', { icon: 'plus-circle' }));
  const sh = await text('Sources', 'Agent', 'onAccent', { align: 'CENTER', w: 100 }); const shw = al('VERTICAL', { pad: [P ? 32 : 44.8, 0, 16, 0], name: 'Sources heading' }); shw.appendChild(sh); s.appendChild(shw); shw.layoutSizingHorizontal = 'FILL'; sh.layoutSizingHorizontal = 'FILL';
  const grid = al(P ? 'VERTICAL' : 'HORIZONTAL', { gap: 12, name: 'Sources' }); s.appendChild(grid); grid.layoutSizingHorizontal = 'FILL';
  for (const [i, [host, title, url]] of SRCS.entries()) {
    const pl = al('HORIZONTAL', { fill: 'tint', r: 18, pad: [14.4, 16, 14.4, 16], gap: 13.6, align: 'CENTER', name: `Source ${i + 1}` }); grid.appendChild(pl); pl.layoutSizingHorizontal = 'FILL';
    const fav = figma.createFrame(); fav.name = 'Site icon'; fav.resize(41.6, 41.6); fav.cornerRadius = 12; fav.fills = [paint('white')]; fav.clipsContent = false; pl.appendChild(fav);
    const img = figma.createRectangle(); img.name = 'Favicon ' + host; img.resize(24, 24); img.cornerRadius = 4; img.fills = [paint('white')]; put(fav, img, 8.8, 8.8); STILLS.push({ id: img.id, file: `fav-${host}.png` });
    const badge = al('HORIZONTAL', { fill: 'deep', r: 999, align: 'CENTER', justify: 'CENTER', name: 'Number' }); badge.resize(20, 20); badge.primaryAxisSizingMode = 'FIXED'; badge.counterAxisSizingMode = 'FIXED'; badge.appendChild(await text(String(i + 1), 'Cite', 'primary')); put(fav, badge, 41.6 - 14.4, -5.6);
    const tx = al('VERTICAL', { gap: 2.4, name: 'Text' }); pl.appendChild(tx); tx.layoutSizingHorizontal = 'FILL';
    tx.appendChild(await text(host, 'Caption', 'inkSecondary')); const tt = await text(title, 'Source title', 'onAccent', { w: 100 }); tx.appendChild(tt); tt.layoutSizingHorizontal = 'FILL';
    await pl.setReactionsAsync([{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'URL', url, openInNewTab: true }] }]);
  }
  const ft = await footer(f); ft.x = 0; ft.y = s.y + s.height + (P ? 20.56 : 45.76);
  f.resize(W, ft.y + ft.height);
  if (toast) { const tt = al('HORIZONTAL', { name: 'Toast', fill: 'lime', r: 999, pad: [13.6, 22.4, 13.6, 22.4] }); tt.appendChild(await text('Copied to your clipboard', 'Button', 'onAccent')); put(f, tt, 0, 0); tt.x = (W - tt.width) / 2; tt.y = VH - 24 - tt.height; f.numberOfFixedChildren = 1; }
  return f;
}
async function buildError(name, kind) {
  const f = base(name, VH); const bh = VH - 68; band(f, bh, 'error', 'error-' + kind); await nav(f, false);
  const E = { net: ['wifi-slash', "Can't reach the research server", 'Check that the backend is running, then try again. Your question is still here.'], server: ['warning', "The agents couldn't finish", 'Something went wrong while they worked. Try again, or reword your question.'] }[kind];
  const w = P ? 349 : 480;
  const a = al('VERTICAL', { name: 'Alert', fill: 'white', r: 30, pad: Array(4).fill(P ? 22.4 : 38.4), gap: 14.4, align: 'CENTER' }); a.effects = SHADOW; f.appendChild(a); fixW(a, w);
  const badge = al('HORIZONTAL', { fill: 'deep', r: 999, align: 'CENTER', justify: 'CENTER', name: 'Badge' }); badge.resize(64, 64); badge.primaryAxisSizingMode = 'FIXED'; badge.counterAxisSizingMode = 'FIXED'; badge.appendChild(await icon(E[0], 'blue', 32)); a.appendChild(badge);
  const h = await text(E[1], 'Card heading', 'onAccent', { align: 'CENTER', w: 100 }); a.appendChild(h); h.layoutSizingHorizontal = 'FILL';
  const p = await text(E[2], 'Card body', 'inkSecondary', { align: 'CENTER', w: 100 }); a.appendChild(p); p.layoutSizingHorizontal = 'FILL';
  const yq = al('VERTICAL', { fill: 'tint', r: 16, pad: [14.4, 16, 14.4, 16], gap: 4.8, name: 'Your question' }); a.appendChild(yq); yq.layoutSizingHorizontal = 'FILL';
  yq.appendChild(await text('Your question', 'Tag', 'mid')); const qt = await text(Q, 'Small body', 'onAccent', { w: 100 }); yq.appendChild(qt); qt.layoutSizingHorizontal = 'FILL';
  const stk = al('VERTICAL', { gap: 8.8, name: 'Buttons', pad: [4.8, 0, 0, 0] }); a.appendChild(stk); stk.layoutSizingHorizontal = 'FILL';
  for (const b of [await pill('Try again', 'deep', 'primary', { icon: 'arrow-clockwise' }), await pill('Edit question', 'tint', 'onAccent')]) { stk.appendChild(b); b.layoutSizingHorizontal = 'FILL'; }
  a.x = (W - w) / 2; a.y = 68 + (bh - a.height) / 2;
  return f;
}
const pre = P ? 'P' : '';
const SPECS = [
  [`${pre}01 Home`, () => buildHome(`${pre}01 Home`)],
  [`${pre}02 Ask typed`, () => buildTyped(`${pre}02 Ask typed`)],
  [`${pre}03a Working, fill starts`, () => buildWorking(`${pre}03a Working, fill starts`, .3, '0:02')],
  [`${pre}03b Working, filling`, () => buildWorking(`${pre}03b Working, filling`, .74, '0:09')],
  [`${pre}03c Working, fill complete`, () => buildWorking(`${pre}03c Working, fill complete`, 1, '0:24', true)],
  [`${pre}04 Answer`, () => buildAnswer(`${pre}04 Answer`)],
  [`${pre}05 Answer copied`, () => buildAnswer(`${pre}05 Answer copied`, true)],
  [`${pre}06 Can't reach the server`, () => buildError(`${pre}06 Can't reach the server`, 'net')],
  [`${pre}07 Agents couldn't finish`, () => buildError(`${pre}07 Agents couldn't finish`, 'server')],
];
const S = figma.createSection(); S.name = P ? 'Phone 390' : 'Desktop 1440'; page.appendChild(S); S.x = 0; S.y = P ? 3600 : 0;
let maxH = 0;
for (const [i, [name, fn]] of SPECS.entries()) { const f = await fn(); S.appendChild(f); f.x = 80 + i * (W + 120); f.y = 100; maxH = Math.max(maxH, f.height); OUT[name] = f.id; }
S.resizeWithoutConstraints(80 + SPECS.length * (W + 120), maxH + 200);
return { section: S.id, frames: OUT, stills: STILLS };
