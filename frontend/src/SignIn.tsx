import { useEffect, useRef, useState, type RefObject } from "react";
import { Icon } from "./Icon";

type Props = {
  apiUrl: string;
  onSignedIn: (session: { token: string; email: string; used_today: number; daily_limit: number }) => void;
  note?: string; // shown above the form, e.g. when a session ended
  emailRef?: RefObject<HTMLInputElement | null>;
};

// Read the backend's error message, or fall back to a plain one
async function detailOf(result: Response, fallback: string) {
  try {
    const data = await result.json();
    return typeof data.detail === "string" ? data.detail : fallback;
  } catch {
    return fallback;
  }
}

// Sign in with a Penn State email. While the backend has no email account set up, the address alone
// signs you in; once it does, the backend emails a 6-digit code and you type it back.
export function SignIn({ apiUrl, onSignedIn, note, emailRef }: Props) {
  const [codes, setCodes] = useState(false);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);
  const localEmail = useRef<HTMLInputElement>(null);
  const emailInput = emailRef ?? localEmail;
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeInput.current?.focus();
  }, [step]);

  // Ask the backend whether sign-in uses emailed codes
  useEffect(() => {
    let alive = true;
    fetch(`${apiUrl}/auth/settings`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => { if (alive && data) setCodes(Boolean(data.codes)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [apiUrl]);

  // Email only: the address signs you in
  const continueWithEmail = async () => {
    if (working) return;
    setWorking(true);
    setError("");
    try {
      const result = await fetch(`${apiUrl}/auth/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!result.ok) {
        setError(await detailOf(result, "We couldn't sign you in. Try again."));
        return;
      }
      onSignedIn(await result.json());
    } catch {
      setError("Can't reach the research server. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  };

  const sendCode = async (again = false) => {
    if (working) return;
    setWorking(true);
    setError("");
    setResent(false);
    try {
      const result = await fetch(`${apiUrl}/auth/request-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!result.ok) {
        setError(await detailOf(result, "We couldn't send the code. Try again."));
        return;
      }
      const data = await result.json();
      setEmail(data.email);
      setCode("");
      setStep("code");
      if (again) setResent(true);
    } catch {
      setError("Can't reach the research server. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  };

  const verify = async () => {
    if (working || code.replace(/\D/g, "").length !== 6) return;
    setWorking(true);
    setError("");
    try {
      const result = await fetch(`${apiUrl}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!result.ok) {
        setError(await detailOf(result, "That code didn't work. Try again."));
        return;
      }
      onSignedIn(await result.json());
    } catch {
      setError("Can't reach the research server. Check your connection and try again.");
    } finally {
      setWorking(false);
    }
  };

  const changeEmail = () => {
    setStep("email");
    setCode("");
    setError("");
    setResent(false);
    requestAnimationFrame(() => emailInput.current?.focus());
  };

  return (
    <form className="qcard signin" noValidate
      onSubmit={e => { e.preventDefault(); if (step === "code") verify(); else if (codes) sendCode(); else continueWithEmail(); }}>
      {note && <p className="snote">{note}</p>}

      {step === "email" ? (
        <>
          <label className="slabel" htmlFor="signin-email">Sign in with your Penn State email</label>
          <input id="signin-email" ref={emailInput} className="sfield" type="email" inputMode="email"
            autoComplete="email" placeholder="abc1234@psu.edu" value={email} disabled={working}
            onChange={e => setEmail(e.target.value)} aria-describedby={error ? "signin-error" : undefined} />
          {error && <p className="serror" id="signin-error" role="alert"><Icon name="warning" />{error}</p>}
          <div className="qrow">
            <span className="hint">{codes ? "We'll email you a 6-digit code" : "Only Penn State emails can sign in"}</span>
            <button type="submit" className="pill send" disabled={working || !email.trim()}>
              {codes ? (working ? "Sending..." : "Send code") : (working ? "Signing in..." : "Continue")}
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="slabel" htmlFor="signin-code">Enter the code we sent to <b>{email}</b></label>
          <input id="signin-code" ref={codeInput} className="sfield code" type="text" inputMode="numeric"
            autoComplete="one-time-code" placeholder="000000" maxLength={6} value={code} disabled={working}
            onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            aria-describedby={error ? "signin-error" : undefined} />
          {error && <p className="serror" id="signin-error" role="alert"><Icon name="warning" />{error}</p>}
          {resent && !error && <p className="sok" role="status">We sent a new code.</p>}
          <div className="qrow">
            <span className="slinks">
              <button type="button" className="slink" onClick={changeEmail} disabled={working}>Use a different email</button>
              <button type="button" className="slink" onClick={() => sendCode(true)} disabled={working}>Send a new code</button>
            </span>
            <button type="submit" className="pill send" disabled={working || code.length !== 6}>
              {working ? "Checking..." : "Sign in"}
            </button>
          </div>
        </>
      )}
    </form>
  );
}
