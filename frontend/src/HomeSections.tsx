import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { LOGOS } from "./logos";

const SAMPLE_Q =
  "Compare Microsoft and Google's enterprise AI strategies and identify opportunities a mid-sized software company should monitor.";

const STACK = ["React", "TypeScript", "Vite", "FastAPI", "Python", "LangGraph", "DeepSeek", "Tavily"];

// Sample content for the How it works list (written from a sample answer, not a live run)
const AGENTS = [
  { name: "Supervisor", icon: "compass", job: "Reads your question and routes it to the Researcher.",
    more: <><span>Routes it to</span><div className="q">Researcher, then Analyst, then Writer</div></> },
  { name: "Researcher", icon: "magnifying-glass", job: "Writes its own web searches and reads the results through Tavily.",
    more: <><span>Searches it ran</span><div className="q">Microsoft enterprise AI strategy</div><div className="q">Google Vertex AI enterprise adoption</div><div className="q">AI opportunities for mid-sized software firms</div></> },
  { name: "Analyst", icon: "chart-bar", job: "Weighs what the sources say and pulls out the conclusions.",
    more: <><span>What it found</span><ul><li>Microsoft sells AI inside seats companies already license.</li><li>Google competes on model quality and price per use.</li><li>Both are adding agents that act inside other apps.</li></ul></> },
  { name: "Writer", icon: "pen-nib", job: "Turns the findings into one answer and lists every source it used.",
    more: <><span>Hands back</span><span className="ok"><Icon name="check-circle" />Answer with its sources</span></> },
];

export function HomeSections({ onAsk }: { onAsk: () => void }) {
  const pin = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  // Scrolling through How it works lights one agent at a time
  useEffect(() => {
    const read = () => {
      const el = pin.current;
      if (!el || innerWidth < 768) return;
      const r = el.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, -r.top / Math.max(1, r.height - innerHeight)));
      setStep(Math.min(3, Math.floor(p * 4)));
    };
    read();
    addEventListener("scroll", read, { passive: true });
    addEventListener("resize", read);
    return () => { removeEventListener("scroll", read); removeEventListener("resize", read); };
  }, []);

  const logos = [...STACK, ...STACK, ...STACK].map((name, i) => {
    const l = LOGOS.find(x => x[0] === name);
    if (!l) return null;
    return (
      <span className="logo" key={i} aria-hidden={i >= STACK.length || undefined}>
        <svg viewBox={l[1]} aria-hidden="true" dangerouslySetInnerHTML={{ __html: l[2] }} />
        {l[0]}
      </span>
    );
  });

  return (
    <div className="home">
      <div className="built" aria-label="Built with">
        <div className="mask"><div className="track">{logos}</div></div>
      </div>

      <section className="s-how" id="how">
        <div className="howpin" ref={pin}>
          <div className="howstage wrap">
            <div className="howtext">
              <h2>One question, four agents</h2>
              <p>Each agent does one job, then hands its work to the next. Scroll to follow a question through.</p>
              <div className="sample"><span>Sample question</span><q>{SAMPLE_Q}</q></div>
            </div>
            <div className="agentlist">
              {AGENTS.map((a, i) => (
                <article key={a.name} className={`ag${i === step ? " on" : ""}`}>
                  <span className="ic"><Icon name={a.icon} /></span>
                  <div className="nm"><h3>{a.name}</h3><span>{a.job}</span></div>
                  <div className="more"><div><div className="in">{a.more}</div></div></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="closing">
        <div className="wrap">
          <h2>Try it with your own question</h2>
          <p>Type anything you would normally research, and the agents will bring back an answer with its sources.</p>
          <button type="button" className="pill lime" onClick={onAsk}>Ask a question <Icon name="arrow-up" /></button>
          <div className="foot">
            <button type="button" className="brand" onClick={onAsk}><span className="tile"><Icon name="magnifying-glass" /></span>Multi-Agent AI</button>
            <p>Built by Multi-Agent Team 3 in Nittany AI's ELP, Fall 2026.</p>
            <div className="row2">
              <a className="pill white sm" href="https://github.com/mspriing/Multiagent-Team-3-ELP-2026" target="_blank" rel="noopener noreferrer"><Icon name="github-logo" />View the code</a>
              <button type="button" className="pill frost sm" onClick={onAsk}>Back to top</button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
