import { useMemo, useState, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Icon } from "./Icon";

import { excerptOf, hostOf, splitSections, urlKey, type EvidenceSource } from "./answerText";

type Props = {
  turnId: string;
  content: string;
  evidence: EvidenceSource[];
  onCopy: (text: string) => void;
};

export function Answer({ turnId, content, evidence, onCopy }: Props) {
  const [open, setOpen] = useState(false);

  const sources = useMemo(() => {
    const seen = new Set<string>();
    return evidence.filter(s => s.url && !seen.has(urlKey(s.url)) && seen.add(urlKey(s.url)));
  }, [evidence]);
  const index = useMemo(() => new Map(sources.map((s, i) => [urlKey(s.url), i + 1])), [sources]);
  const sections = useMemo(() => splitSections(content, sources.length > 0), [content, sources.length]);

  const goToSource = (n: number) => {
    setOpen(true);
    requestAnimationFrame(() => {
      const el = document.getElementById(`src-${turnId}-${n}`);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "nearest" });
      el.classList.remove("flash"); void el.offsetWidth; el.classList.add("flash");
    });
  };

  const components: Components = {
    a: ({ href, children }) => {
      const n = href ? index.get(urlKey(href)) : undefined;
      const link = <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
      if (!n) return link;
      return (
        <span className="nw">
          {link}
          <a className="cite" href={`#src-${turnId}-${n}`} aria-label={`Source ${n}`}
            onClick={e => { e.preventDefault(); goToSource(n); }}>{n}</a>
        </span>
      );
    },
  };

  const count = sections.length;
  const wide = (i: number) => i === 0 || (i === count - 1 && (count - 1) % 2 === 1);

  return (
    <>
      <div className="groups">
        {sections.map((s, i) => (
          <section key={i} className={`grp${i === 0 ? " lead" : ""}${wide(i) ? " wide" : ""}`}>
            <h3 className="glabel">{s.label}</h3>
            <div className="gcard doc">
              <ReactMarkdown remarkPlugins={[[remarkGfm, { singleTilde: false }]]} components={components}>
                {s.body.trim()}
              </ReactMarkdown>
            </div>
          </section>
        ))}
      </div>

      <div className="after">
        {sources.length > 0 ? (
          <details className="ledger" open={open} onToggle={e => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
            <summary>
              <span className="lk"><Icon name="link" /></span>
              <span>{open ? "Hide" : "View"} sources ({sources.length})</span>
              <Icon name="caret-down" className="car" />
            </summary>
            <div className="body">
              <p className="note">Sources retrieved by the Researcher Agent. These are not individually verified citations.</p>
              {sources.map((s, i) => (
                <SourceRow key={s.id ?? s.url} id={`src-${turnId}-${i + 1}`} n={i + 1} source={s} />
              ))}
            </div>
          </details>
        ) : <span />}
        <button type="button" className="pill frost sm" onClick={() => onCopy(content)}>
          <Icon name="copy" />Copy answer
        </button>
      </div>
    </>
  );
}

function SourceRow({ id, n, source }: { id: string; n: number; source: EvidenceSource }) {
  const [broken, setBroken] = useState(false);
  const host = hostOf(source.url);
  const excerpt = excerptOf(source.content);
  return (
    <a className="ev" id={id} href={source.url} target="_blank" rel="noopener noreferrer">
      <span className="fav">
        {broken ? <Icon name="globe" /> : (
          <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`} alt="" onError={() => setBroken(true)} />
        )}
      </span>
      <span className="tx">
        <strong>{source.title || host}</strong>
        <span className="host">{host}</span>
        {excerpt && <p>{excerpt}</p>}
      </span>
      <b>{n}</b>
    </a>
  );
}

export function Working({ children }: { children?: ReactNode }) {
  return (
    <span className="working" role="status">
      <span className="dot" aria-hidden="true" />
      {children ?? "Your AI agents are working..."}
    </span>
  );
}
