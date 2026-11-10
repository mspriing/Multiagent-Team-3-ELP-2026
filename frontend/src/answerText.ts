// Helpers that turn the Writer's Markdown and the Researcher's evidence into what the answer cards show.

export type EvidenceSource = {
  id?: number;
  title: string;
  url: string;
  content: string;
};

export type Section = { label: string; body: string };

const SOURCES_HEADING = /^(sources|references|citations|sources and references)$/i;

// Normalise a URL so the Writer's links match the Researcher's evidence
export const urlKey = (url: string) =>
  url.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[#?].*$/, "").replace(/\/+$/, "").toLowerCase();

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

// Raw page text from the search tool can run to thousands of characters, so the ledger shows the opening of it
export const excerptOf = (text: string, max = 260) => {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const stop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  if (stop > max * 0.5) return cut.slice(0, stop + 1);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
};

// Split the Writer's Markdown at its headings: each part becomes its own card with the heading as its label.
// Text before the first heading is the direct answer. The Sources section is dropped when the ledger lists them.
export function splitSections(md: string, dropSources: boolean): Section[] {
  const out: Section[] = [];
  let cur: Section = { label: "Short answer", body: "" };
  let inFence = false;
  let sawText = false;
  for (const line of md.split("\n")) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    // Divider lines only separated sections in plain text; the cards already do that
    if (!inFence && /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(line)) continue;
    const h = !inFence && line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      // A title at the very top repeats the question, so the first card keeps the "Short answer" label
      if (!sawText && h[1].length === 1 && out.length === 0) continue;
      if (cur.body.trim()) out.push(cur);
      cur = { label: h[2].replace(/\*\*/g, "").trim(), body: "" };
      continue;
    }
    if (line.trim()) sawText = true;
    cur.body += line + "\n";
  }
  if (cur.body.trim()) out.push(cur);
  const kept = dropSources ? out.filter(s => !SOURCES_HEADING.test(s.label.replace(/:$/, ""))) : out;
  return kept.length ? kept : out;
}

// Long answers read best as one column; short ones sit two to a row like the design
export const isLongAnswer = (sections: Section[]) =>
  sections.length > 6 || sections.slice(1).some(s => s.body.length > 700);
