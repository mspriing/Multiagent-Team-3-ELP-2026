# Research assistant frontend: three directions (spec, 2026-11-02)

Scope: what the `final-project` backend does today. One question goes to `POST /chat`, the Supervisor, Researcher, Analyst and Writer run in order, one Markdown answer comes back. No backend changes.

Shared across all three:
- Palette: midnight #343645, deep #1F2029, white #FCFFFF, lightning blue #62C0F6, lime #B2F601 (lime is the single accent, about 10% of the paint).
- Light: the OXS light studio shader (fine flutes, feathered reveal), running live in the page. The light moves between states over about 1.2 s and never jumps.
- Honesty: the backend does not report which agent is working, so no screen lights up one agent. The Working timer counts real elapsed seconds in the browser.
- Words: Apple register for headlines, plain instructions for the rest. No eyebrows, dots, em dashes, ellipses or durations.
- Every control works: Send and Enter, suggestions, Copy answer, New question, source links, Try again, Edit question.

| Screen | A. Stage (one dark stage, white reading sheet) | B. Window (split screen, fluted window) | C. Brief (moving header, morphing dock) |
|---|---|---|---|
| Type | Satoshi | Clash Display headlines, Switzer body | General Sans |
| Signature | The light follows your cursor, and on Send the question lifts into a giant headline while the light sweeps the whole stage | The right half is a fluted glass window. The agents' names sit behind it in huge type and bend through the flutes as they drift | One dock at the bottom changes shape: question box, then a working pill with the timer, then the answer's actions, then the Copied toast |
| Ask | Headline bottom left, a wide question capsule docked under it, three suggestions as plain links. Light upper right, drifting toward the cursor | Left half solid midnight with the headline, a solid question box and suggestions. Right half is the window with the four names drifting slowly behind the glass | Full-height moving header. Headline centred low, the dock floats at the bottom as the question box |
| Working | The question becomes the headline. The four agent names run along the bottom as large outlined words with a light sweeping through them. Timer beside them | The window widens to most of the screen and the names stream faster through the flutes. The left column keeps the question and the timer | The header shrinks to the top half. Below it, a vertical line with the four agents as stations and a light running down it on a loop. The dock becomes a pill: Researching 0:14 |
| Answer | A white sheet rises over the stage. Inside it, a sticky left column with the question, Copy answer, New question and the sources; the answer reads on the right | The window narrows to a slim right column holding the sources. The answer reads on midnight in the wide left column | The header settles into a band with the question as the title. Contents on the left built from the answer's headings, the answer in the middle, sources on the right. The dock holds Copy answer and New question |
| Error | The light cools and dims. The message sits large, with Try again and Edit question | The window goes still and cool. The message sits in the left column | The dock turns into the error message with Try again. The header light cools |
| Phone | Stage stacks; the sheet becomes full width | The window becomes a band across the top | Header band on top, the dock stays at the bottom |

Placeholders (logged here, not settled): the three suggestion questions (the first is the Week 8 benchmark), the sample answer and its four sources.

---

## Final state (2026-11-05, approved)

The three directions above were the starting point. What Michael approved after round 3:

- **Background:** "Fluted Isotherm, blended": one smooth heat field with two heat areas (bottom left, top right) blended through deep, midnight, blue, green and lime, under fine refracting flutes taken from his "effect background · test". The top and the space behind text stay calm; lime is the hottest colour. Look 6 in `src/home.html`; Figma shader "ELP isotherm heat", style 3.
- **Answer:** Sections. Short answer full width, the middle sections side by side on desktop, sources two to a line; one column on phone.
- **Nav:** brand and "Ask a question" sit near the screen edges (about 24px at 1440) and come in as the window narrows.
- **Send:** the fill lives in the Send button; no timer (the app has none).
- **Errors:** "Offline" (can't reach the server) and "Agents couldn't finish", each with Try again and Edit question.
- **Figma:** file SIRN9OIMJSl50bn77jTqA0, page Master: user workflow, 14 screens, whole-page Home, Answer and Answer copied.
- **Rebuild Figma from the page:** `node build.mjs`, then `node figma-build/extract.mjs` and `node figma-build/extract-full.mjs`, `python3 figma-build/compact.py`, and run `figma-build/builder.js` with the data in use_figma.
- **Team code:** not changed. The team's `final-project` branch was last updated Oct 26.

## Conversation screens (Nov 9)
After the team added saved conversations (84bf158), `src/app.html` designs them in the same system: sidebar (list, empty, active with ×, closed), multi-turn thread with the docked composer, a View sources / Hide sources dropdown per answer, follow-up researching, Loading conversation, Couldn't load this conversation, and a phone drawer. In Figma on Master from y 7440, plus a Saved conversations band on the User workflow board.
