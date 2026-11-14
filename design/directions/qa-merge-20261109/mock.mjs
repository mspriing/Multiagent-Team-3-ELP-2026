// Stand-in for the FastAPI backend: same endpoints and response shapes, no API keys.
import http from 'http';
const ev = [
  { id: 1, title: 'Azure OpenAI Service', url: 'https://azure.microsoft.com/en-us/products/ai-services/openai-service', content: 'Azure OpenAI Service provides REST API access to OpenAI\'s powerful language models including GPT-4o. These models can be easily adapted to your specific task including but not limited to content generation, summarization, image understanding, semantic search, and natural language to code translation. '.repeat(6) },
  { id: 2, title: 'Vertex AI | Google Cloud', url: 'https://cloud.google.com/vertex-ai', content: 'Vertex AI is a fully-managed, unified AI development platform for building and using generative AI. Access and utilize Vertex AI Studio, Agent Builder, and 200+ foundation models.' },
  { id: 3, title: 'Microsoft 365 Copilot', url: 'https://www.microsoft.com/en-us/microsoft-365/copilot', content: 'Copilot works alongside you in Word, Excel, PowerPoint, Outlook and Teams.' },
  { id: 4, title: '', url: 'https://example-unknown-host.invalid/report', content: '' },
];
const md = `Microsoft sells AI through the products companies already pay for, with Copilot inside Microsoft 365 and [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service/) for custom builds. Google leans on [Vertex AI](https://cloud.google.com/vertex-ai).

## Where they differ
- **Microsoft** bundles AI into seats companies already license.
- Google competes on model quality and price per use.

## What to watch
1. Marketplace listings
2. Model pricing

| Company | Model |
|---|---|
| Microsoft | GPT-4o |
| Google | Gemini |

## Uncertainty
Some figures could not be verified.

## Sources
- [Azure OpenAI](https://azure.microsoft.com/en-us/products/ai-services/openai-service)
- [Vertex AI](https://cloud.google.com/vertex-ai)`;
const convos = [];
const store = {};
let n = 100;
const send = (res, code, body) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' }); res.end(JSON.stringify(body)); };
const mode = process.env.MODE || 'ok';
http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const u = new URL(req.url, 'http://x');
  if (mode === 'down') { req.socket.destroy(); return; }
  if (u.pathname === '/conversations') return send(res, 200, convos);
  const m = u.pathname.match(/^\/conversations\/(.+)$/);
  if (m) { const id = decodeURIComponent(m[1]); setTimeout(() => store[id] && !id.startsWith('bad') ? send(res, 200, { conversation: convos.find(c => c.id === id), messages: store[id] }) : send(res, 404, { detail: 'Conversation not found.' }), 700); return; }
  if (u.pathname === '/chat' && req.method === 'POST') {
    let b = ''; req.on('data', d => b += d); req.on('end', () => {
      const { message, conversation_id } = JSON.parse(b);
      setTimeout(() => {
        if (/fail/i.test(message)) return send(res, 500, { detail: 'An internal error occurred. Please try again.' });
        const id = conversation_id || 'c' + (++n);
        if (!store[id]) { store[id] = []; convos.unshift({ id, title: message.slice(0, 100), created_at: new Date().toISOString() }); }
        const mid = ++n;
        const evidence = /nosrc/i.test(message) ? [] : ev;
        store[id].push({ id: mid - 1000, role: 'user', content: message, evidence: [] }, { id: mid, role: 'assistant', content: md, evidence });
        send(res, 200, { response: md, conversation_id: id, message_id: mid, evidence });
      }, Number(process.env.DELAY || 1500));
    }); return;
  }
  send(res, 404, { detail: 'Not found' });
}).listen(8000, '127.0.0.1', () => console.log('mock on 8000', mode));
