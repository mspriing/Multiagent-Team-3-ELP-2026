// B2 Band frame builder for use_figma. SIZE is set by the caller line above this file ('desktop' or 'phone').
const page = figma.root.children.find(p => p.name === 'B2 Band');
await figma.setCurrentPageAsync(page);
for (const s of ['Regular', 'Medium', 'SemiBold']) await figma.loadFontAsync({ family: 'Geist', style: s });
const VAR = {}; for (const [k, id] of Object.entries({ page: 'VariableID:15:64', field: 'VariableID:15:65', white: 'VariableID:2:7', lime: 'VariableID:15:75', onAccent: 'VariableID:15:71', primary: 'VariableID:15:67', tint: 'VariableID:26:118', inkBody: 'VariableID:26:119', inkSecondary: 'VariableID:26:120', inkHint: 'VariableID:26:121', inkPlaceholder: 'VariableID:26:122', bandSecondary: 'VariableID:26:123', blue: 'VariableID:15:76' })) VAR[k] = await figma.variables.getVariableByIdAsync(id);
const paint = k => figma.variables.setBoundVariableForPaint({ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }, 'color', VAR[k]);
const STY = {}; for (const s of await figma.getLocalTextStylesAsync()) if (s.name.startsWith('B2/')) STY[s.name.slice(3)] = s.id;
const ICON = { Supervisor: '26:150', Researcher: '26:153', Analyst: '26:156', Writer: '26:159' };
const lightSrc = await figma.getNodeByIdAsync('16:39');
const P = SIZE === 'phone';

async function text(str, style, color, o = {}) {
  const t = figma.createText();
  await t.setTextStyleIdAsync(STY[style]);
  t.characters = str; t.fills = [paint(color)];
  t.textAlignHorizontal = o.align || 'LEFT';
  if (o.w) { t.textAutoResize = 'HEIGHT'; t.resize(o.w, t.height); } else t.textAutoResize = 'WIDTH_AND_HEIGHT';
  if (o.name) t.name = o.name;
  return t;
}
function al(dir, o = {}) {
  const f = figma.createAutoLayout(dir);
  f.fills = o.fill ? [paint(o.fill)] : [];
  if (o.name) f.name = o.name;
  if (o.pad) { const [t, r, b, l] = o.pad; f.paddingTop = t; f.paddingRight = r; f.paddingBottom = b; f.paddingLeft = l; }
  if (o.gap != null) f.itemSpacing = o.gap;
  if (o.r != null) f.cornerRadius = o.r;
  if (o.align) f.counterAxisAlignItems = o.align;
  if (o.justify) f.primaryAxisAlignItems = o.justify;
  return f;
}
function put(parent, node, x, y) { parent.appendChild(node); node.x = x; node.y = y; return node; }
async function pill(label, fill, color, name, arrow) {
  const b = al('HORIZONTAL', { fill, pad: [13.6, 24, 13.6, 24], r: 999, gap: 8, align: 'CENTER', name });
  b.appendChild(await text(label, 'Button', color));
  if (arrow) b.appendChild(await text('→', 'Button', color, { name: 'Arrow' }));
  return b;
}
async function tile(agent, role) {
  const t = al('VERTICAL', { fill: 'white', r: 16, name: `Agent tile/${agent}`, pad: P ? [12.8, 14.4, 12.8, 14.4] : [22.4, 22.4, 22.4, 22.4], justify: P ? 'MIN' : 'SPACE_BETWEEN', gap: P ? 9.6 : 0 });
  const sq = al('HORIZONTAL', { fill: 'page', r: 12, name: 'Icon square', align: 'CENTER', justify: 'CENTER' });
  const size = P ? 33.6 : 41.6; sq.resize(size, size); sq.primaryAxisSizingMode = 'FIXED'; sq.counterAxisSizingMode = 'FIXED';
  const comp = await figma.getNodeByIdAsync(ICON[agent]); const inst = comp.createInstance(); inst.rescale((P ? 20 : 24.8) / 24); sq.appendChild(inst);
  t.appendChild(sq);
  const tx = al('VERTICAL', { gap: 4, name: 'Text' });
  tx.appendChild(await text(agent, P ? 'Phone agent' : 'Agent', 'onAccent'));
  const rl = await text(role, P ? 'Phone agent role' : 'Agent role', 'inkSecondary'); tx.appendChild(rl); rl.layoutSizingHorizontal = 'FILL';
  t.appendChild(tx); tx.layoutSizingHorizontal = 'FILL';
  return t;
}
const AGENTS = [['Supervisor', 'Reads your question first'], ['Researcher', 'Searches the web with Tavily'], ['Analyst', 'Weighs what the sources say'], ['Writer', 'Writes the answer with its sources']];
const Q = "Compare Microsoft and Google's enterprise AI strategies and identify opportunities a mid-sized software company should monitor.";
const SUGS = [Q, 'What is changing in AI chip supply?', 'How are universities using AI agents?'];
const SRCS = [['azure.microsoft.com', 'Azure OpenAI', 'https://azure.microsoft.com/products/ai-services/openai-service'], ['cloud.google.com', 'Vertex AI', 'https://cloud.google.com/vertex-ai'], ['microsoft.com', 'Microsoft 365 Copilot overview', 'https://www.microsoft.com/microsoft-365/copilot'], ['workspace.google.com', 'Gemini for Workspace', 'https://workspace.google.com/solutions/ai/']];
const ERR = { net: ["We couldn't reach\nthe research server.", 'Check that the backend is running, then try again. Your question is still here.'], server: ["The agents couldn't\nfinish this one.", 'Something went wrong while they worked. Try again, or reword your question.'] };
const FX = {
  ask: { position: { x: 50, y: 104 }, spread: .42, warp: 1.3, intensity: 1.5, speed: .35, stop1: .55, stop2: .9 },
  working: { position: { x: 50, y: 100 }, spread: .55, warp: 1.7, intensity: 2.0, speed: 1.2, stop1: .5, stop2: .86 },
  answer: { position: { x: 84, y: 100 }, spread: .4, warp: 1.2, intensity: 1.3, speed: .3, stop1: .46, stop2: .82 },
  error: { position: { x: 50, y: 104 }, spread: .34, warp: 1, intensity: 1.0, speed: .05, stop1: .46, stop2: .82, light: .85, contrast: 1.2, glow: { r: .278, g: .455, b: .58, a: 1 }, core: { r: .384, g: .753, b: .965, a: 1 } },
};
function lightFill(st) {
  const f = JSON.parse(JSON.stringify(lightSrc.fills[0]));
  const byName = {}; for (const [k, m] of Object.entries(f.propertyMetadata)) byName[m.name] = k;
  for (const [n, val] of Object.entries(FX[st])) f.properties[byName[n]] = val;
  return f;
}
const M = P ? {
  W: 390, H: 844, band: { ask: 539, working: 844, answer: 361, error: 696 }, brandY: 20.56, pad: 20.56,
  hero: { y: 154, w: 349, gap: 18 }, q: { x: 21, y: 475, w: 349 }, clock: 167, wq: { y: 259, w: 349 }, crew: { x: 21, y: 396, w: 349, cols: 2, gap: 8 },
  ans: { y: 76, w: 349, btnY: 273, cardY: 382, main: [21, 349], side: [21, 349, 1443], H: 1856, cardPad: 22.4 },
  err: { y: 314, cardY: 632, card: [21, 349], cardPad: 22.4 },
  heroText: 'Ask once.\nFour agents\nanswer.', ansText: "Compare Microsoft and\nGoogle's enterprise\nAI strategies and\nidentify opportunities\na mid-sized software\ncompany should monitor.",
} : {
  W: 1440, H: 900, band: { ask: 641, working: 900, answer: 382, error: 710 }, brandY: 48, pad: 48,
  hero: { y: 194, w: 832, gap: 18 }, q: { x: 336, y: 577, w: 768 }, clock: 222, wq: { y: 375, w: 677 }, crew: { x: 304, y: 507, w: 832, cols: 4, gap: 16 },
  ans: { y: 125, w: 777, btnY: 278, cardY: 428, main: [96, 876], side: [992, 352, 428], H: 1087, cardPad: 39 },
  err: { y: 315, cardY: 646, card: [400, 640], cardPad: 39 },
  heroText: 'Ask once.\nFour agents answer.', ansText: "Compare Microsoft and Google's enterprise\nAI strategies and identify opportunities a\nmid-sized software company should monitor.",
};
const S = n => (P ? 'Phone ' + n.toLowerCase() : n);

async function frame(spec) {
  const { name, state } = spec;
  const H = state === 'answer' ? M.ans.H : M.H;
  const f = figma.createFrame(); f.name = name; f.resize(M.W, H); f.fills = [paint('field')]; f.clipsContent = true;
  // Band: still, live light, then its content
  const bh = M.band[state];
  const band = figma.createFrame(); band.name = 'Band (window)'; band.resize(M.W, bh); band.fills = [paint('page')]; band.clipsContent = true; put(f, band, 0, 0);
  const still = figma.createRectangle(); still.name = 'Band still (light only, from the prototype)'; still.resize(M.W, bh); still.fills = [paint('page')]; put(band, still, 0, 0);
  const live = figma.createRectangle(); live.name = 'effect background, Band light (OXS light studio, live, no flutes)'; live.resize(M.W, bh); live.fills = [lightFill(state)]; put(band, live, 0, 0);
  const brand = await text('Multi-Agent AI', 'Brand', 'primary', { name: 'Brand', w: M.W, align: 'CENTER' }); put(band, brand, 0, M.brandY);
  if (state === 'ask') {
    const hero = al('VERTICAL', { name: 'Hero', gap: M.hero.gap, align: 'CENTER' });
    hero.appendChild(await text(M.heroText, S('Hero'), 'primary', { align: 'CENTER' }));
    hero.appendChild(await text('A Supervisor, a Researcher, an Analyst and a Writer take your question in turn, and you get one response with its sources.', S('Lead'), 'bandSecondary', { align: 'CENTER', w: P ? 349 : 530 }));
    put(band, hero, 0, M.hero.y); hero.x = (M.W - hero.width) / 2;
    // Question card, overlapping the band's bottom edge
    const card = al('VERTICAL', { name: 'Question card', fill: 'white', r: 22, pad: [17.6, 17.6, 16, 17.6], gap: 14.4 });
    card.effects = [{ type: 'DROP_SHADOW', color: { r: .04, g: .043, b: .063, a: .55 }, offset: { x: 0, y: 30 }, radius: 60, spread: -30, visible: true, blendMode: 'NORMAL' }];
    put(f, card, M.q.x, M.q.y); card.resize(M.q.w, card.height); card.primaryAxisSizingMode = 'AUTO'; card.counterAxisSizingMode = 'FIXED';
    const box = al('HORIZONTAL', { name: 'Question box', pad: [5.6, 7.2, 5.6, 7.2] });
    box.appendChild(await text(spec.typed ? Q : 'Ask a research question', P ? 'Phone input' : 'Input', spec.typed ? 'onAccent' : 'inkPlaceholder', { w: 100 }));
    card.appendChild(box); box.layoutSizingHorizontal = 'FILL'; box.children[0].layoutSizingHorizontal = 'FILL'; box.minHeight = P ? 60 : 69;
    if (!spec.typed || true) {
      const chips = al('HORIZONTAL', { name: 'Suggestions', gap: 8, pad: [0, 5.6, 0, 5.6] }); chips.layoutWrap = 'WRAP'; chips.counterAxisSpacing = 8;
      card.appendChild(chips); chips.layoutSizingHorizontal = 'FILL';
      for (const [i, s] of SUGS.entries()) {
        const c = al('HORIZONTAL', { name: 'Suggestion', fill: 'tint', r: 999, pad: [8.8, 15.2, 8.8, 15.2] });
        chips.appendChild(c);
        const t = await text(s, 'Chip', 'onAccent'); c.appendChild(t);
        if (i === 0) { c.layoutSizingHorizontal = 'FILL'; t.layoutSizingHorizontal = 'FILL'; c.cornerRadius = P ? 26 : 27; }
      }
    }
    const row = al('HORIZONTAL', { name: 'Send row', justify: 'SPACE_BETWEEN', align: 'CENTER' });
    card.appendChild(row); row.layoutSizingHorizontal = 'FILL';
    const hint = al('HORIZONTAL', { name: 'Hint', pad: [0, 0, 0, 7.2] }); hint.appendChild(await text('Press Enter to send', 'Caption', 'inkHint')); row.appendChild(hint);
    row.appendChild(await pill('Send', 'page', 'primary', 'Send', true));
  }
  if (state === 'working') {
    const clock = await text(spec.timer, S('Clock'), 'primary', { name: 'Clock', w: M.W, align: 'CENTER' }); put(band, clock, 0, M.clock);
    const wq = await text(Q, S('Question'), 'bandSecondary', { name: 'Question', w: M.wq.w, align: 'CENTER' }); put(band, wq, (M.W - M.wq.w) / 2, M.wq.y);
    const crew = figma.createAutoLayout('HORIZONTAL'); crew.name = 'Crew'; crew.fills = []; crew.layoutWrap = 'WRAP'; crew.itemSpacing = M.crew.gap; crew.counterAxisSpacing = M.crew.gap;
    put(band, crew, M.crew.x, M.crew.y); crew.resize(M.crew.w, 10); crew.primaryAxisSizingMode = 'FIXED'; crew.counterAxisSizingMode = 'AUTO';
    const tw = (M.crew.w - M.crew.gap * (M.crew.cols - 1)) / M.crew.cols;
    for (const [a, r] of AGENTS) { const t = await tile(a, r); crew.appendChild(t); t.resize(tw, P ? t.height : 176); t.layoutSizingHorizontal = 'FIXED'; if (P) t.layoutSizingVertical = 'HUG'; }
  }
  if (state === 'answer') {
    const head = al('VERTICAL', { name: 'Answer head', gap: 26, align: 'CENTER' });
    head.appendChild(await text(M.ansText, S('Title'), 'primary', { align: 'CENTER', name: 'Question' }));
    const btns = al('HORIZONTAL', { name: 'Actions', gap: 9.6 });
    btns.appendChild(await pill('Copy answer', 'lime', 'onAccent', 'Copy answer'));
    btns.appendChild(await pill('New question', 'white', 'onAccent', 'New question'));
    head.appendChild(btns);
    put(band, head, 0, M.ans.y); head.x = (M.W - head.width) / 2;
    // Answer card
    const main = al('VERTICAL', { name: 'Answer card', fill: 'white', r: 22, pad: Array(4).fill(M.ans.cardPad), gap: 35.2 });
    put(f, main, M.ans.main[0], M.ans.cardY); main.resize(M.ans.main[1], main.height); main.counterAxisSizingMode = 'FIXED'; main.primaryAxisSizingMode = 'AUTO';
    const sec = async (h, body, list) => {
      const s = al('VERTICAL', { name: 'Section/' + h, gap: 11.2 }); main.appendChild(s); s.layoutSizingHorizontal = 'FILL';
      const ht = await text(h, S('Section'), 'onAccent'); s.appendChild(ht); ht.layoutSizingHorizontal = 'FILL';
      const bt = await text(body, 'Body', 'inkBody'); s.appendChild(bt); bt.layoutSizingHorizontal = 'FILL';
      if (list) { bt.setRangeListOptions(0, body.length, { type: 'UNORDERED' }); bt.paragraphSpacing = 6.4; }
      return bt;
    };
    const p1 = 'Microsoft sells AI through the products companies already pay for, with Copilot inside Microsoft 365 and Azure OpenAI for custom builds. Google leans on its own Gemini models and Vertex AI, and pushes hardest with teams already on Google Cloud and Workspace.';
    const bt = await sec('Short answer', p1);
    for (const [word, url] of [['Azure OpenAI', SRCS[0][2]], ['Vertex AI', SRCS[1][2]]]) { const i = p1.indexOf(word); bt.setRangeTextDecoration(i, i + word.length, 'UNDERLINE'); try { bt.setRangeTextDecorationColor(i, i + word.length, { value: { r: .384, g: .753, b: .965, a: 1 } }); bt.setRangeTextDecorationThickness(i, i + word.length, { value: 2, unit: 'PIXELS' }); bt.setRangeTextDecorationOffset(i, i + word.length, { value: 4, unit: 'PIXELS' }); } catch (e) {} bt.setRangeHyperlink(i, i + word.length, { type: 'URL', value: url }); }
    await sec('Where they differ', 'Microsoft bundles AI into seats companies already license, so adoption follows existing contracts.\nGoogle competes on model quality and price per use, backed by its own chips for training and serving.\nBoth are adding agents that act inside other apps, which is where new spending is moving.', true);
    await sec('What a mid-sized software company should watch', 'Marketplace listings on Azure and Google Cloud, which decide how easily buyers can pay for your product.\nPrice changes for model use, which move the cost of every AI feature you ship.\nAgent standards for connecting apps, which decide whether their agents can use your product.', true);
    // Sources card
    const side = al('VERTICAL', { name: 'Sources card', fill: 'white', r: 22, pad: Array(4).fill(M.ans.cardPad), gap: 16 });
    put(f, side, M.ans.side[0], M.ans.side[2]); side.resize(M.ans.side[1], side.height); side.counterAxisSizingMode = 'FIXED'; side.primaryAxisSizingMode = 'AUTO';
    side.appendChild(await text('Sources', 'Card title', 'onAccent'));
    const list = al('VERTICAL', { name: 'Sources', gap: 9.6 }); side.appendChild(list); list.layoutSizingHorizontal = 'FILL';
    for (const [host, title, url] of SRCS) {
      const c = al('VERTICAL', { name: 'Source card', fill: 'tint', r: 14, pad: [15.2, 17.6, 15.2, 17.6], gap: 3.2 }); list.appendChild(c); c.layoutSizingHorizontal = 'FILL';
      c.appendChild(await text(host, 'Caption', 'inkSecondary')); c.appendChild(await text(title, 'Source title', 'onAccent'));
      c.reactions = [{ trigger: { type: 'ON_CLICK' }, actions: [{ type: 'URL', url, openInNewTab: true }] }];
    }
    if (spec.toast) {
      const t = al('HORIZONTAL', { name: 'Toast', fill: 'lime', r: 999, pad: [13.6, 22.4, 13.6, 22.4] }); t.appendChild(await text('Copied to your clipboard', 'Button', 'onAccent'));
      put(f, t, 0, 0); t.x = (M.W - t.width) / 2; t.y = M.H - 24 - t.height; t.scrollBehavior = 'FIXED';
    }
  }
  if (state === 'error') {
    const [title, body] = ERR[spec.err];
    const h = await text(title, S('Title'), 'primary', { name: 'Error title', align: 'CENTER', w: M.W }); put(band, h, 0, M.err.y);
    const card = al('VERTICAL', { name: 'Error card', fill: 'white', r: 22, pad: Array(4).fill(M.err.cardPad), gap: 22.4, align: 'CENTER' });
    put(f, card, M.err.card[0], M.err.cardY); card.resize(M.err.card[1], card.height); card.counterAxisSizingMode = 'FIXED'; card.primaryAxisSizingMode = 'AUTO';
    const p = await text(body, S('Lead'), 'inkSecondary', { align: 'CENTER', w: 100 }); card.appendChild(p); p.layoutSizingHorizontal = 'FILL';
    const btns = al('HORIZONTAL', { name: 'Actions', gap: 9.6 });
    btns.appendChild(await pill('Try again', 'page', 'primary', 'Try again')); btns.appendChild(await pill('Edit question', 'tint', 'onAccent', 'Edit question'));
    card.appendChild(btns);
  }
  return f;
}
