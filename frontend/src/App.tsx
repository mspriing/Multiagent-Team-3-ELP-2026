import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { Answer, Working } from "./Answer";
import type { EvidenceSource } from "./answerText";
import { Composer } from "./Composer";
import { createHeat, type Heat, type HeatParams } from "./heat";
import { HomeSections } from "./HomeSections";
import { Icon } from "./Icon";

// Structure of a saved conversation
type Conversation = {
  id: string;
  title: string;
  created_at: string;
};

// Structure of a user or AI message
type ChatMessage = {
  id?: number;
  role: "user" | "assistant";
  content: string;
  evidence?: EvidenceSource[];
};

// One question and its answer, as the page shows them
type Turn = { key: string; question: string; answer?: ChatMessage };

// Why a request failed: "net" when the server can't be reached, "server" when it answered with an error
type SendError = { kind: "net" | "server"; question: string };

const API_URL = "http://127.0.0.1:8000";

const SUGGESTIONS = [
  "Compare Microsoft and Google's enterprise AI strategies and identify opportunities a mid-sized software company should monitor.",
  "What is changing in AI chip supply?",
  "How are universities using AI agents?",
];

// Retrieve all saved conversations, newest first
async function loadConversations(): Promise<Conversation[]> {
  const result = await fetch(`${API_URL}/conversations`);

  if (!result.ok) {
    throw new Error("Failed to load conversations");
  }

  const data = await result.json();
  return Array.isArray(data) ? data : [];
}

const isPhone = () => window.innerWidth < 768;

// Pair each question with the answer that follows it
function toTurns(messages: ChatMessage[]): Turn[] {
  const turns: Turn[] = [];
  messages.forEach((m, i) => {
    if (m.role === "user") turns.push({ key: `q-${m.id ?? i}`, question: m.content });
    else {
      const last = turns[turns.length - 1];
      if (last && !last.answer) last.answer = m;
      else turns.push({ key: `a-${m.id ?? i}`, question: "", answer: m });
    }
  });
  return turns;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement("textarea");
    t.value = text; t.style.position = "fixed"; t.style.opacity = "0";
    document.body.appendChild(t); t.select();
    const ok = document.execCommand("copy");
    t.remove();
    return ok;
  }
}

function App() {
  // What the user types
  const [message, setMessage] = useState("");

  // Current conversation ID
  const [conversationId, setConversationId] = useState<string | null>(null);

  // List of saved conversations, and whether the list failed to load
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listFailed, setListFailed] = useState(false);

  // Messages in the selected conversation
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  // Whether the agents are working, and the question they are working on
  const [loading, setLoading] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState("");

  // Whether a saved conversation is being opened, and the one that failed to open
  const [opening, setOpening] = useState(false);
  const [failedOpenId, setFailedOpenId] = useState<string | null>(null);

  // The last failed question
  const [sendError, setSendError] = useState<SendError | null>(null);

  // Sidebar: shown or hidden on a computer, a drawer on a phone
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // "Copied to your clipboard"
  const [copied, setCopied] = useState(false);

  const heatCanvas = useRef<HTMLCanvasElement>(null);
  const heat = useRef<Heat | null>(null);
  const heroInput = useRef<HTMLTextAreaElement>(null);
  const dockInput = useRef<HTMLTextAreaElement>(null);
  const barFill = useRef<HTMLSpanElement>(null);
  const scrollNext = useRef<"top" | "bottom" | "last" | null>(null);

  const turns = useMemo(() => toTurns(messages), [messages]);
  const view: "new" | "thread" | "loading" | "missing" =
    opening ? "loading" : failedOpenId ? "missing" : messages.length === 0 ? "new" : "thread";

  // STEP 1: Retrieve all saved conversations
  const fetchConversations = useCallback(async () => {
    try {
      setConversations(await loadConversations());
      setListFailed(false);
    } catch (err) {
      console.error("Error loading conversations:", err);
      setListFailed(true);
    }
  }, []);

  // Load saved conversations when React starts
  useEffect(() => {
    let alive = true;
    loadConversations()
      .then((data) => { if (alive) { setConversations(data); setListFailed(false); } })
      .catch((err) => { console.error("Error loading conversations:", err); if (alive) setListFailed(true); });
    return () => { alive = false; };
  }, []);

  // STEP 2: Open an existing conversation
  const openConversation = async (id: string) => {
    if (loading || opening) return;

    setOpening(true);
    setFailedOpenId(null);
    setSendError(null);
    setDrawerOpen(false);
    scrollNext.current = "top";

    try {
      const result = await fetch(`${API_URL}/conversations/${encodeURIComponent(id)}`);

      if (!result.ok) {
        throw new Error("Failed to load conversation");
      }

      const data = await result.json();

      // Set the active conversation
      setConversationId(id);

      // Load its previous messages and evidence
      setMessages(Array.isArray(data.messages) ? data.messages : []);

      // Clear the input
      setMessage("");
      scrollNext.current = "last";
    } catch (err) {
      console.error("Error opening conversation:", err);
      setConversationId(id);
      setMessages([]);
      setFailedOpenId(id);
    } finally {
      setOpening(false);
    }
  };

  // STEP 3: Start a new conversation
  const newChat = () => {
    if (loading || opening) return;

    setConversationId(null);
    setMessages([]);
    setMessage("");
    setSendError(null);
    setFailedOpenId(null);
    setDrawerOpen(false);
    scrollNext.current = "top";
  };

  // Close the current conversation without deleting it
  const closeConversation = () => {
    newChat();
  };

  // STEP 4: Send a message to the agents
  const sendMessage = async (text?: string) => {
    const submittedMessage = (text ?? message).trim();

    // Prevent empty or overlapping requests
    if (!submittedMessage || loading || opening) return;

    setLoading(true);
    setSendError(null);
    setPendingQuestion(submittedMessage);
    scrollNext.current = messages.length ? "bottom" : null;

    try {
      // Send the message and active conversation ID
      const result = await fetch(`${API_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: submittedMessage,
          conversation_id: conversationId,
        }),
      });

      if (!result.ok) {
        throw new Error("Backend request failed");
      }

      // Read FastAPI's response
      const data = await result.json();

      if (
        typeof data.response !== "string" ||
        !data.response.trim() ||
        typeof data.conversation_id !== "string"
      ) {
        throw new Error("Invalid response from backend");
      }

      // Add the user question and AI answer
      // including evidence for the assistant response
      setMessages((previous) => [
        ...previous,
        {
          role: "user",
          content: submittedMessage,
        },
        {
          id: data.message_id,
          role: "assistant",
          content: data.response,
          evidence: Array.isArray(data.evidence)
            ? data.evidence
            : [],
        },
      ]);

      // Preserve the conversation ID
      setConversationId(data.conversation_id);

      // Clear the input after successful submission
      setMessage("");
      scrollNext.current = messages.length ? "last" : "top";

      // Refresh saved conversations in the sidebar
      await fetchConversations();
    } catch (err) {
      console.error("Error sending message:", err);
      // A TypeError from fetch means the server could not be reached
      setSendError({ kind: err instanceof TypeError ? "net" : "server", question: submittedMessage });
      scrollNext.current = messages.length ? "bottom" : "top";
    } finally {
      setLoading(false);
      setPendingQuestion("");
    }
  };

  const retryOpen = () => {
    if (failedOpenId) openConversation(failedOpenId);
  };

  const editQuestion = () => {
    if (sendError) setMessage(sendError.question);
    setSendError(null);
    requestAnimationFrame(() => (messages.length ? dockInput : heroInput).current?.focus());
  };

  const copyAnswer = async (text: string) => {
    if (await copyText(text)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  };

  const toggleSidebar = () => {
    if (isPhone()) setDrawerOpen(o => !o);
    else setSidebarOpen(o => !o);
  };

  // "Ask a question": focus the box that is on screen
  const ask = () => {
    if (view === "thread") { dockInput.current?.focus(); return; }
    if (view !== "new") newChat();
    if (sendError && messages.length === 0) setSendError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    window.setTimeout(() => heroInput.current?.focus({ preventScroll: true }), 350);
  };

  // ---------- Heat background ----------
  useEffect(() => {
    if (!heatCanvas.current) return;
    heat.current = createHeat(heatCanvas.current, { E: .62, S: .35, Q: 0, hx: .14, hy: -.06, h2x: .88, h2y: 1, cx: .5, cy: .65, cz: .62 });
    return () => { heat.current?.dispose(); heat.current = null; };
  }, []);

  const showError = sendError !== null;
  useEffect(() => {
    const aim = () => {
      const pos = isPhone() ? { hx: .12, hy: -.03, h2x: .94, h2y: .99 } : { hx: .14, hy: -.06, h2x: .88, h2y: 1 };
      let p: Partial<HeatParams>;
      if (view === "new" && !showError) {
        // Keep the quiet zone behind the headline
        const h = document.querySelector(".newview h1")?.getBoundingClientRect();
        p = { E: .62, S: loading ? 1 : .35, Q: 0, ...pos, cx: h ? (h.left + h.width / 2) / innerWidth : .5, cy: h ? 1 - (h.top + h.height / 2) / innerHeight : .65, cz: loading ? .72 : .62 };
      } else if (view === "thread" && !showError) p = { E: loading ? .56 : .5, S: loading ? 1 : .25, Q: 1, ...pos, cx: .5, cy: .6, cz: .3 };
      else if (view === "loading") p = { E: .42, S: .4, Q: 1, ...pos, cx: .5, cy: .5, cz: .35 };
      else p = { E: .3, S: .08, Q: 1, ...pos, cx: .5, cy: .5, cz: 0 };
      heat.current?.to(p);
    };
    const raf = requestAnimationFrame(aim);
    addEventListener("resize", aim);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", aim); };
  }, [view, loading, showError, sidebarOpen]);

  // ---------- Scroll after the page changes ----------
  useLayoutEffect(() => {
    const where = scrollNext.current;
    if (!where || opening) return;
    scrollNext.current = null;
    requestAnimationFrame(() => {
      if (where === "top") window.scrollTo({ top: 0, behavior: "instant" });
      else if (where === "bottom") window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
      else {
        // Bring the newest question to the top, just under the nav
        const turn = document.querySelector<HTMLElement>(".thread .turn:last-of-type");
        const nav = document.querySelector<HTMLElement>(".nav")?.offsetHeight ?? 68;
        if (turn) window.scrollTo({ top: Math.max(0, turn.getBoundingClientRect().top + window.scrollY - nav - 24), behavior: "instant" });
      }
    });
  }, [messages, pendingQuestion, sendError, opening, failedOpenId]);

  // ---------- Scroll fill under the nav ----------
  useEffect(() => {
    let x = 0, v = 0, target = 0, raf = 0;
    const read = () => { const h = document.documentElement.scrollHeight - innerHeight; target = h > 0 ? scrollY / h : 0; };
    const tick = () => {
      v += (220 * (target - x) - 40 * v) / 60; x += v / 60;
      if (barFill.current) barFill.current.style.transform = `scaleX(${Math.max(0, Math.min(1, x))})`;
      raf = requestAnimationFrame(tick);
    };
    read(); tick();
    addEventListener("scroll", read, { passive: true });
    addEventListener("resize", read);
    return () => { cancelAnimationFrame(raf); removeEventListener("scroll", read); removeEventListener("resize", read); };
  }, []);

  // Phone drawer: Escape closes it, and the page behind it does not scroll
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    const onResize = () => { if (!isPhone()) setDrawerOpen(false); };
    addEventListener("keydown", onKey);
    addEventListener("resize", onResize);
    document.documentElement.style.overflow = "hidden";
    return () => { removeEventListener("keydown", onKey); removeEventListener("resize", onResize); document.documentElement.style.overflow = ""; };
  }, [drawerOpen]);

  const busy = loading || opening;
  const errorCard = sendError && (
    <div className={`alert${messages.length ? " inline" : ""}`} role="alert">
      <div className="badge">{sendError.kind === "net" ? <b>Offline</b> : <Icon name="warning" />}</div>
      <h2>{sendError.kind === "net" ? "Can't reach the research server" : "The agents couldn't finish"}</h2>
      <p>{sendError.kind === "net"
        ? "Check that the backend is running, then try again. Your question is still here."
        : "Something went wrong while they worked. Try again, or reword your question."}</p>
      {messages.length === 0 && <div className="yourq"><span>Your question</span><q>{sendError.question}</q></div>}
      <div className="stack">
        <button type="button" className="pill deep" onClick={() => sendMessage(sendError.question)}><Icon name="arrow-clockwise" />Try again</button>
        <button type="button" className="pill tint" onClick={editQuestion}>Edit question</button>
      </div>
    </div>
  );

  const appClass = ["app", !sidebarOpen && "sb-closed", drawerOpen && "drawer"].filter(Boolean).join(" ");

  return (
    <div className={appClass} data-view={view}>
      <canvas className="heat" ref={heatCanvas} aria-hidden="true" />
      <div className="page">

        {/* TOP BAR */}
        <header className="nav">
          <div className="in">
            <div className="navl">
              <button type="button" className="iconbtn" onClick={toggleSidebar}
                aria-label={isPhone() ? "Show conversations" : sidebarOpen ? "Hide conversations" : "Show conversations"}
                aria-expanded={isPhone() ? drawerOpen : sidebarOpen}>
                <Icon name="list" />
              </button>
              <button type="button" className="brand" onClick={newChat} disabled={busy}>
                <span className="tile"><Icon name="magnifying-glass" /></span><span className="name">Multi-Agent AI</span>
              </button>
            </div>
            <button type="button" className="pill white sm cta" onClick={ask} disabled={opening}>Ask a question</button>
          </div>
          <div className="bar" aria-hidden="true"><span ref={barFill} /></div>
        </header>

        <div className="shell">
          <div className="scrim" onClick={() => setDrawerOpen(false)} />

          {/* LEFT SIDEBAR */}
          <aside className="side" aria-label="Conversations">
            <div className="dhead">
              <button type="button" className="brand" onClick={newChat} disabled={busy}>
                <span className="tile"><Icon name="magnifying-glass" /></span>Multi-Agent AI
              </button>
              <button type="button" className="iconbtn" onClick={() => setDrawerOpen(false)} aria-label="Close conversations">
                <Icon name="x" />
              </button>
            </div>

            <button type="button" className="pill white newchat" onClick={newChat} disabled={busy}>
              <Icon name="plus-circle" />New chat
            </button>

            <h2>Previous conversations</h2>

            <div className="convos">
              {conversations.length === 0 && (listFailed ? (
                <div className="empty">
                  <b>Couldn't load your conversations.</b>
                  <span>Check that the backend is running.</span>
                  <button type="button" className="pill frost sm retry" onClick={fetchConversations}>Try again</button>
                </div>
              ) : (
                <div className="empty">
                  <b>No saved conversations yet.</b>
                  <span>Your questions and answers will show up here.</span>
                </div>
              ))}

              {conversations.map((conversation) => {
                const active = conversationId === conversation.id;
                return (
                  <div key={conversation.id} className={`convo${active ? " on" : ""}`}>
                    <button type="button" className="open" onClick={() => openConversation(conversation.id)}
                      disabled={busy} aria-current={active ? "true" : undefined} title={conversation.title}>
                      {conversation.title}
                    </button>
                    {active && (
                      <button type="button" className="x" onClick={closeConversation} disabled={busy}
                        title="Close conversation" aria-label="Close conversation">
                        <Icon name="x" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </aside>

          {/* MAIN AREA */}
          <main className="main">
            <div>
              {view === "new" && (showError ? (
                <section className="errwrap">{errorCard}</section>
              ) : (
                <>
                  <section className="newview">
                    <div>
                      <h1>Research powered by multiple AI agents</h1>
                      <p className="lead">A Supervisor routes your question, then a Researcher, an Analyst and a Writer each do one part of the work.</p>
                    </div>
                    <div className="qwrap">
                      <Composer value={message} onChange={setMessage} onSend={() => sendMessage()}
                        busy={loading} disabled={busy} suggestions={SUGGESTIONS} inputRef={heroInput} />
                    </div>
                  </section>
                  <HomeSections onAsk={ask} />
                </>
              ))}

              {view === "thread" && (
                <section className="thread" aria-live="polite">
                  {turns.map((turn) => (
                    <article className="turn" key={turn.key}>
                      {turn.question && <h2 className="qh">{turn.question}</h2>}
                      {turn.answer && (
                        <Answer turnId={turn.key} content={turn.answer.content}
                          evidence={turn.answer.evidence ?? []} onCopy={copyAnswer} />
                      )}
                    </article>
                  ))}
                  {loading && pendingQuestion && (
                    <article className="turn">
                      <h2 className="qh">{pendingQuestion}</h2>
                      <Working />
                    </article>
                  )}
                  {sendError && (
                    <article className="turn">
                      <h2 className="qh">{sendError.question}</h2>
                      {errorCard}
                    </article>
                  )}
                </section>
              )}

              {view === "loading" && (
                <section className="center">
                  <span className="loadpill" role="status"><span className="dot" aria-hidden="true" />Loading conversation...</span>
                </section>
              )}

              {view === "missing" && (
                <section className="errwrap">
                  <div className="alert" role="alert">
                    <div className="badge"><Icon name="warning" /></div>
                    <h2>Couldn't load this conversation</h2>
                    <p>It may have been removed, or the server didn't answer. Try again, or start a new chat.</p>
                    <div className="stack">
                      <button type="button" className="pill deep" onClick={retryOpen}><Icon name="arrow-clockwise" />Try again</button>
                      <button type="button" className="pill tint" onClick={newChat}>New chat</button>
                    </div>
                  </div>
                </section>
              )}
            </div>

            {(view === "thread" || view === "loading") && (
              <div className="dock">
                <Composer value={message} onChange={setMessage} onSend={() => sendMessage()}
                  busy={loading} disabled={busy} docked inputRef={dockInput} />
              </div>
            )}
          </main>
        </div>
      </div>

      <div className={`toast${copied ? " on" : ""}`} role="status" aria-live="polite">Copied to your clipboard</div>
    </div>
  );
}

export default App;
