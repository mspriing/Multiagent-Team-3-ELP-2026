import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop?: () => void; // stops the agents while they work
  busy: boolean; // the agents are working on this box's question
  disabled: boolean; // nothing can be sent right now (working, or opening a conversation)
  docked?: boolean;
  suggestions?: string[];
  inputRef?: RefObject<HTMLTextAreaElement | null>;
};

// The question box. Enter sends, Shift+Enter starts a new line. While the agents work, the Send button
// frosts over and lime fills it from the left. The backend reports no progress, so the fill eases toward
// 92% over time and is cleared when the answer (or an error) comes back. Clicking it while it works stops
// the question (it reads "Stop" on hover, and always on touch screens).
export function Composer({ value, onChange, onSend, onStop, busy, disabled, docked, suggestions, inputRef }: Props) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ta = inputRef ?? localRef;
  const sendRef = useRef<HTMLButtonElement>(null);
  const busySince = useRef(0);

  // Grow with the text
  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }, [value, ta]);

  useEffect(() => {
    const btn = sendRef.current;
    if (!btn) return;
    if (!busy) { btn.style.setProperty("--p", "0"); return; }
    const start = performance.now();
    busySince.current = start;
    let raf = 0;
    const tick = () => {
      const p = 0.92 * (1 - Math.exp(-(performance.now() - start) / 5200));
      btn.style.setProperty("--p", p.toFixed(4));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [busy]);

  const canSend = !disabled && value.trim().length > 0;

  return (
    <form className="qcard" onSubmit={e => { e.preventDefault(); if (canSend) onSend(); }}>
      <label className="sr" htmlFor={docked ? "q-dock" : "q-new"}>Your research question</label>
      <textarea
        id={docked ? "q-dock" : "q-new"}
        ref={ta}
        rows={docked ? 1 : 2}
        placeholder="Ask a research question..."
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) onSend();
          }
        }}
      />
      {suggestions && !busy && (
        <div className="chips">
          {suggestions.map(s => (
            <button key={s} type="button" className="chip" disabled={disabled}
              onClick={() => { onChange(s); ta.current?.focus(); }}>{s}</button>
          ))}
        </div>
      )}
      <div className={`qrow${busy ? " busy" : ""}`}>
        {busy
          ? <span className="status" role="status"><span className="dot" aria-hidden="true" />Your AI agents are working...</span>
          : <span className="hint">Press Enter to send</span>}
        {busy ? (
          // key keeps Stop and Send as separate buttons, so the click that stops can't also send
          <button key="stop" ref={sendRef} type="button" className="pill send busy" disabled={!onStop}
            onClick={e => { e.preventDefault(); if (performance.now() - busySince.current > 600) onStop?.(); }}
            aria-label="Stop researching">
            <span className="fillbar" aria-hidden="true" />
            <span className="lbl-run" aria-hidden="true">Researching...</span>
            <span className="lbl-stop" aria-hidden="true"><span className="stopsq" />Stop</span>
          </button>
        ) : (
          <button key="send" ref={sendRef} type="submit" className="pill send" disabled={!canSend}>
            <span className="fillbar" aria-hidden="true" />
            Send
          </button>
        )}
      </div>
    </form>
  );
}
