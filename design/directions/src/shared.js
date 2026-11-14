/* Shared engine for the three directions: live OXS light studio background, flow state, answer rendering.
   Backend contract (unchanged): POST http://127.0.0.1:8000/chat { message } -> { response: markdown }.
   Add ?live=1 to call the real backend; otherwise the page runs a timed demo. ?state=answer etc. opens a state. */

const PALETTE = {
  deep: [0.122, 0.125, 0.161], mid: [0.204, 0.212, 0.271], blue: [0.384, 0.753, 0.965],
  lime: [0.698, 0.965, 0.004], white: [0.988, 1, 1], blueDim: [0.278, 0.455, 0.58],
};
const rgb = a => ({ r: a[0], g: a[1], b: a[2] });

/* Base shader settings in the new palette. Each direction passes overrides per state. */
const BASE_FX = {
  ground: rgb(PALETTE.deep), mid: rgb(PALETTE.mid), glow: rgb(PALETTE.blue), core: rgb(PALETTE.lime), highlight: rgb(PALETTE.white),
  layout: 2, glass: 1, density: 46, refraction: 0.6, light: 1.2, edge: 0.6, grain: 0.06, bow: 0, angle: 0, seed: 3,
  contrast: 1.35, sheen2: 0.4, spread: 0.42, warp: 1.5, intensity: 2.7, stop1: 0.46, stop2: 0.82,
  reveal: 0.85, revealAngle: 150, feather: 0.3, revealOffset: 0.1, speed: 0.6, position: { x: 74, y: 40 },
};
const COOL = { glow: rgb(PALETTE.blueDim), core: rgb(PALETTE.blue), intensity: 2.0, light: 0.85, speed: 0.25, contrast: 1.2 };

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mixVal = (a, b, t) => {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (a && typeof a === 'object') { const o = {}; for (const k in b) o[k] = mixVal(a[k], b[k], t); return o; }
  return t < 1 ? a : b;
};

/* createLight(canvas, params): runs the shader live. light.to(params, ms) eases every value; phase is
   accumulated so changing speed never jumps. Falls back to a CSS gradient when WebGPU is missing. */
async function createLight(canvas, params) {
  let cur = structuredClone({ ...BASE_FX, ...params }), from = cur, target = cur, t0 = 0, dur = 0;
  let pointer = null, follow = 0;
  const api = {
    to(p, ms = 1200) { from = structuredClone(cur); target = structuredClone({ ...target, ...p }); t0 = performance.now(); dur = reduceMotion ? 1 : ms; },
    follow(amount) { follow = amount; },
    ok: false,
  };
  addEventListener('pointermove', e => { pointer = { x: (e.clientX / innerWidth) * 100, y: (e.clientY / innerHeight) * 100 }; });
  if (!navigator.gpu) { canvas.classList.add('fx-fallback'); return api; }
  try {
    const adapter = await navigator.gpu.requestAdapter(); const device = await adapter.requestDevice();
    const ctx = canvas.getContext('webgpu'); const format = navigator.gpu.getPreferredCanvasFormat();
    ctx.configure({ device, format, alphaMode: 'opaque' });
    const frame = { state: {}, params: {}, time: 0 };
    LS.setup(device, frame);
    let phase = 0, last = performance.now();
    const loop = now => {
      const dt = Math.min(64, now - last); last = now;
      if (dur) { const k = Math.min(1, (now - t0) / dur); cur = mixVal(from, target, ease(k)); if (k >= 1) dur = 0; }
      const shown = structuredClone(cur);
      shown.density = Math.max(14, Math.round(canvas.clientWidth / 31)); // flutes stay about 31px wide at every width
      if (follow && pointer && !reduceMotion) { shown.position = { x: cur.position.x + (pointer.x - cur.position.x) * follow, y: cur.position.y + (pointer.y - cur.position.y) * follow }; }
      phase += dt * (reduceMotion ? 0 : cur.speed);
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      frame.params = { ...shown, speed: 1 }; frame.time = phase;
      frame.output = { width: w, height: h, format, createView: () => ctx.getCurrentTexture().createView() };
      LS.render(device, frame);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    api.ok = true; document.documentElement.classList.add('fx-live');
  } catch (e) { canvas.classList.add('fx-fallback'); }
  return api;
}

/* Sample answer, shaped like the Writer agent's Markdown. Placeholder content for the design. */
const SAMPLE_Q = "Compare Microsoft and Google's enterprise AI strategies and identify opportunities a mid-sized software company should monitor.";
const SUGGESTIONS = [SAMPLE_Q, "What is changing in AI chip supply?", "How are universities using AI agents?"];
const SAMPLE_MD = `## Short answer
Microsoft sells AI through the products companies already pay for, with Copilot inside Microsoft 365 and [Azure OpenAI](https://azure.microsoft.com/products/ai-services/openai-service) for custom builds. Google leans on its own Gemini models and [Vertex AI](https://cloud.google.com/vertex-ai), and pushes hardest with teams already on Google Cloud and Workspace.

## Where they differ
- Microsoft bundles AI into seats companies already license, so adoption follows existing contracts.
- Google competes on model quality and price per use, backed by its own chips for training and serving.
- Both are adding agents that act inside other apps, which is where new spending is moving.

## What a mid-sized software company should watch
- Marketplace listings on Azure and Google Cloud, which decide how easily buyers can pay for your product.
- Price changes for model use, which move the cost of every AI feature you ship.
- Agent standards for connecting apps, which decide whether their agents can use your product.

## Sources
- [Microsoft 365 Copilot overview](https://www.microsoft.com/microsoft-365/copilot)
- [Azure OpenAI Service](https://azure.microsoft.com/products/ai-services/openai-service)
- [Vertex AI and Gemini](https://cloud.google.com/vertex-ai)
- [Gemini for Workspace](https://workspace.google.com/solutions/ai/)`;

const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const inline = s => esc(s).replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
/* Renders the subset of Markdown the Writer uses: ## headings, - lists, paragraphs, links, bold. */
function renderMarkdown(md, { skipSources = false } = {}) {
  const out = []; let list = null; const heads = []; let skipping = false;
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    // The page lists sources in its own panel, so the Writer's Sources section is not repeated in the text.
    if (skipSources && /^#{1,3}\s+sources\s*$/i.test(line)) { skipping = true; continue; }
    if (skipping) { if (/^#{1,3}\s+/.test(line)) skipping = false; else continue; }
    if (!line) { if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; } continue; }
    const h = line.match(/^#{1,3}\s+(.*)$/);
    if (h) { if (list) { out.push('<ul>' + list.join('') + '</ul>'); list = null; } const id = 'h-' + heads.length; heads.push({ id, text: h[1] }); out.push(`<h2 id="${id}">${inline(h[1])}</h2>`); continue; }
    const li = line.match(/^[-*]\s+(.*)$/);
    if (li) { (list ||= []).push('<li>' + inline(li[1]) + '</li>'); continue; }
    out.push('<p>' + inline(line) + '</p>');
  }
  if (list) out.push('<ul>' + list.join('') + '</ul>');
  return { html: out.join(''), heads };
}
/* Pulls every link out of the answer so the page can list sources without a backend change. */
function sourcesFrom(md) {
  const seen = new Map();
  for (const m of md.matchAll(/\[([^\]]+)\]\((https?:[^)]+)\)/g)) if (!seen.has(m[2])) seen.set(m[2], { title: m[1], url: m[2], host: new URL(m[2]).hostname.replace(/^www\./, '') });
  return [...seen.values()];
}

/* Flow: ask -> working -> answer | error. Mirrors App.tsx (message, loading, error, response). */
function createFlow(onChange) {
  const q = new URLSearchParams(location.search);
  const live = q.get('live') === '1', fail = q.get('fail');
  const s = { state: 'ask', question: '', answer: '', error: null, startedAt: 0 };
  const set = patch => { Object.assign(s, patch); onChange({ ...s }); };
  async function send(text) {
    const question = (text ?? s.question).trim(); if (!question || s.state === 'working') return;
    set({ state: 'working', question, error: null, startedAt: performance.now() });
    try {
      let md;
      if (live) {
        const r = await fetch('http://127.0.0.1:8000/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: question }) });
        if (!r.ok) throw Object.assign(new Error('server'), { kind: 'server' });
        md = (await r.json()).response || '';
      } else {
        await new Promise(r => setTimeout(r, 6500));
        if (fail === 'net') throw new TypeError('net');
        if (fail === 'server') throw Object.assign(new Error('server'), { kind: 'server' });
        md = SAMPLE_MD;
      }
      set({ state: 'answer', answer: md });
    } catch (e) { set({ state: 'error', error: e instanceof TypeError ? 'net' : 'server' }); }
  }
  const api = {
    get: () => ({ ...s }),
    type: text => set({ question: text, state: s.state === 'error' ? 'ask' : s.state === 'answer' ? s.state : 'ask' }),
    send, reset: () => set({ state: 'ask', question: '', answer: '', error: null }),
    edit: () => set({ state: 'ask', error: null }),
    copy: async () => { try { await navigator.clipboard.writeText(s.answer); } catch (e) {} set({ copied: Date.now() }); },
  };
  // Open a named state for review and screenshots: ?state=ask|typed|working|answer|error-net|error-server
  const st = q.get('state');
  if (st === 'typed') s.question = SAMPLE_Q;
  if (st === 'working') Object.assign(s, { state: 'working', question: SAMPLE_Q, startedAt: performance.now() - 14000 });
  if (st === 'answer' || st === 'copied') Object.assign(s, { state: 'answer', question: SAMPLE_Q, answer: SAMPLE_MD, copied: st === 'copied' ? Date.now() + 1e9 : 0 });
  if (st === 'error-net' || st === 'error-server') Object.assign(s, { state: 'error', question: SAMPLE_Q, error: st.slice(6) });
  queueMicrotask(() => onChange({ ...s }));
  return api;
}
/* Picks a state's light settings, with the phone override when the screen is narrow. */
const isPhone = () => innerWidth < 768;
const fxFor = (states, name) => ({ ...states[name], ...(isPhone() && states[name + 'Phone'] ? states[name + 'Phone'] : {}) });
const fmtTime = ms => { const t = Math.floor(ms / 1000); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
const ERRORS = {
  net: { title: "We couldn't reach the research server.", body: 'Check that the backend is running, then try again. Your question is still here.' },
  server: { title: "The agents couldn't finish this one.", body: 'Something went wrong while they worked. Try again, or reword your question.' },
};
const AGENTS = [['Supervisor', 'Reads your question first'], ['Researcher', 'Searches the web with Tavily'], ['Analyst', 'Weighs what the sources say'], ['Writer', 'Writes the answer with its sources']];
