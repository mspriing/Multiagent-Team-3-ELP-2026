"""ELP Week 3 — Team 2 Student Starter
Agentic Research Team: Supervisor + Specialist Agents + Parallelism

Week 2 already gave you:
    Question -> Supervisor -> first assignment -> Tavily -> Response

Week 3 goal:
    Question -> Supervisor -> Specialist Agents in Parallel -> Specialist Results

Your job is to complete the NEW Week 3 TODOs only.

Run:
    python -m pip install -r requirements_team2.txt
    streamlit run team2_week3_student.py

.env:
    TAVILY_API_KEY=your_key
    DEEPSEEK_API_KEY=your_key
"""

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TypedDict

import streamlit as st
from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph
from openai import OpenAI
from tavily import TavilyClient


# ---------------- Configuration ----------------
load_dotenv(os.getenv("ELP_ENV_FILE") or None)

TAVILY_API_KEY = os.getenv("TAVILY_API_KEY")
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY")

if not TAVILY_API_KEY or not DEEPSEEK_API_KEY:
    st.error(
        "Missing API key. Add TAVILY_API_KEY and DEEPSEEK_API_KEY "
        "to a .env file beside this script."
    )
    st.stop()

tavily = TavilyClient(api_key=TAVILY_API_KEY)
deepseek = OpenAI(api_key=DEEPSEEK_API_KEY, base_url="https://api.deepseek.com")


# ---------------- Team 2 Supervisor ----------------
# This carries forward Week 2 homework: each assignment includes output_fields.
TEAM_2_SYSTEM_PROMPT = """
You are the Supervisor for a multi-agent competitive-intelligence research system.

Divide the user's business research question across exactly three specialist roles:
Competitor, Market, and Tech/Regulatory.

Each specialist must receive a distinct, non-overlapping objective. Include a short
output_fields list describing what that specialist should return.
Make every objective specific to the user's named companies, market, geography,
and decision where those details are present. Assign competitor offerings,
positioning, partnerships, and differentiators only to Competitor; market size,
demand, customer adoption, and buyer segments only to Market; and technical
capabilities, standards, regulation, and official policy only to Tech/Regulatory.
When the question does not name a geography or time period, do not invent one.
Give each specialist two or three concrete output fields that fit its scope.

Return only valid JSON in exactly this shape:
{
  "tasks": [
    {
      "agent": "Competitor",
      "objective": "...",
      "output_fields": ["...", "..."]
    },
    {
      "agent": "Market",
      "objective": "...",
      "output_fields": ["...", "..."]
    },
    {
      "agent": "Tech/Regulatory",
      "objective": "...",
      "output_fields": ["...", "..."]
    }
  ]
}

Use exactly these three agent names.
Do not include markdown or text outside the JSON object.
""".strip()

SPECIALIST_PROMPTS = {
    "Competitor": """
You are the Competitor specialist. Research competitors, products, positioning,
partnerships, and differentiators relevant to your assigned objective.
Stay within your assignment. Return a concise research brief grounded in the
provided Tavily results. Do not perform the Market or Tech/Regulatory agent's job.
""".strip(),
    "Market": """
You are the Market specialist. Research market direction, customers, adoption,
industry dynamics, and business context relevant to your assigned objective.
Stay within your assignment. Return a concise research brief grounded in the
provided Tavily results. Do not perform the Competitor or Tech/Regulatory agent's job.
""".strip(),
    "Tech/Regulatory": """
You are the Tech/Regulatory specialist. Research technology developments,
technical capabilities, emerging technology, regulation, and official policy
context relevant to your assigned objective.
Stay within your assignment. Return a concise research brief grounded in the
provided Tavily results. Do not perform the Competitor or Market agent's job.
""".strip(),
}


class ResearchState(TypedDict):
    question: str
    assignments: list[dict]
    specialist_results: list[dict]


def call_model_json(system_prompt: str, user_text: str) -> dict:
    response = deepseek.chat.completions.create(
        model="deepseek-flash",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_text},
        ],
        response_format={"type": "json_object"},
    )
    return json.loads(response.choices[0].message.content)


def supervisor_node(state: ResearchState) -> dict:
    output = call_model_json(TEAM_2_SYSTEM_PROMPT, state["question"])
    tasks = output.get("tasks")

    if not isinstance(tasks, list) or len(tasks) != 3:
        raise ValueError("Supervisor must return exactly three assignments.")

    expected_agents = {"Competitor", "Market", "Tech/Regulatory"}
    seen_agents = set()
    cleaned = []

    for assignment in tasks:
        if not isinstance(assignment, dict):
            raise ValueError("Each assignment must be a JSON object.")

        agent = str(assignment.get("agent", "")).strip()
        objective = str(assignment.get("objective", "")).strip()
        output_fields = assignment.get("output_fields", [])

        if agent not in expected_agents:
            raise ValueError(f"Unexpected specialist role: {agent}")
        if not objective:
            raise ValueError(f"{agent} needs a non-empty objective.")
        if not isinstance(output_fields, list):
            raise ValueError(f"{agent} output_fields must be a list.")

        seen_agents.add(agent)
        cleaned.append(
            {
                "agent": agent,
                "objective": objective,
                "output_fields": [str(field) for field in output_fields],
            }
        )

    if seen_agents != expected_agents:
        raise ValueError(
            "Assignments must include Competitor, Market, and Tech/Regulatory exactly once."
        )

    return {"assignments": cleaned}


# ---------------- Week 3 specialist execution ----------------
def research_assignment(assignment: dict, original_question: str) -> dict:
    """Execute ONE specialist's assignment."""
    agent = assignment["agent"]
    objective = assignment["objective"]
    output_fields = assignment["output_fields"]

    response = tavily.search(query=objective, search_depth="advanced", max_results=5)
    tavily_results = response.get("results", [])
    source_text = "\n\n".join(
        f"Title: {result.get('title', 'Untitled')}\n"
        f"URL: {result.get('url', '')}\n"
        f"Content: {result.get('content', '')}"
        for result in tavily_results
    )

    prompt = (
        f"Original question:\n{original_question}\n\n"
        f"Your objective:\n{objective}\n\n"
        f"Requested output fields:\n{json.dumps(output_fields)}\n\n"
        f"Tavily sources:\n{source_text or 'No sources returned.'}\n\n"
        "Use only the sources above for factual claims and cite their URLs. "
        "If evidence is missing, say so rather than inventing an answer."
    )
    model_response = deepseek.chat.completions.create(
        model="deepseek-flash",
        messages=[
            {"role": "system", "content": SPECIALIST_PROMPTS[agent]},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
    )
    return {
        "agent": agent,
        "objective": objective,
        "output_fields": output_fields,
        "research": model_response.choices[0].message.content,
        "sources": tavily_results,
    }


def specialists_node(state: ResearchState) -> dict:
    """Run all three independent specialist assignments in parallel."""
    specialist_results = []

    with ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(research_assignment, assignment, state["question"])
            for assignment in state["assignments"]
        ]
        for future in as_completed(futures):
            specialist_results.append(future.result())

    return {"specialist_results": specialist_results}


def build_graph():
    graph = StateGraph(ResearchState)
    graph.add_node("supervise", supervisor_node)
    graph.add_node("specialists", specialists_node)

    graph.add_edge(START, "supervise")
    graph.add_edge("supervise", "specialists")
    graph.add_edge("specialists", END)

    return graph.compile()


research_graph = build_graph()


# ---------------- Streamlit UI ----------------
st.set_page_config(page_title="ELP Team 2 — Week 3", page_icon="🧩")
st.title("Team 2 — Agentic Research Team")
st.caption("Supervisor → Specialist Agents → Parallel Research")

question = st.text_input(
    "Enter a business research question",
    value="How is NVIDIA positioning itself against AMD in the AI chip market?",
)

if st.button("Research", type="primary") and question.strip():
    initial_state: ResearchState = {
        "question": question.strip(),
        "assignments": [],
        "specialist_results": [],
    }

    try:
        with st.spinner("Supervising and running specialist research..."):
            result = research_graph.invoke(initial_state)
    except Exception as error:
        st.error(f"The workflow could not finish: {error}")
    else:
        st.subheader("Supervisor assignments")
        st.json(result["assignments"])

        st.subheader("Independent specialist results")
        for item in sorted(
            result["specialist_results"],
            key=lambda x: x.get("agent", ""),
        ):
            with st.expander(item.get("agent", "Specialist"), expanded=True):
                st.write(f"**Objective:** {item.get('objective', '')}")
                st.write(item.get("research", ""))
                st.caption(f"{len(item.get('sources', []))} Tavily sources returned")


"""
ELP Week 4 — Team 2 Student Extension
Evidence & Traceability + SQLite

PASTE THIS FILE BELOW THE EXISTING Week 3 Team 2 CODE.

Do not replace your Week 3 code. This file adds the Week 4 shared evidence
layer and stores the shared evidence store in a small SQLite database.
"""

# ---------------- Week 4: Shared Evidence Store ----------------

import sqlite3

EVIDENCE_DB = "team2_evidence.db"


def init_evidence_db():
    """Create the Week 4 shared evidence table if it does not exist."""
    with sqlite3.connect(EVIDENCE_DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS evidence (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                claim TEXT NOT NULL,
                source TEXT NOT NULL,
                url TEXT NOT NULL,
                publication_date TEXT,
                source_type TEXT NOT NULL,
                evidence TEXT NOT NULL,
                confidence TEXT,
                related_company TEXT,
                report_section TEXT,
                UNIQUE(claim, url)
            )
        """)
        conn.commit()


def save_evidence_records(records: list[dict]):
    """Save validated specialist evidence to SQLite."""
    with sqlite3.connect(EVIDENCE_DB) as conn:
        for record in records:
            # Match the validator's case-insensitive claim deduplication across runs.
            duplicate = conn.execute(
                "SELECT 1 FROM evidence WHERE lower(claim) = ? AND url = ? LIMIT 1",
                (record["claim"].lower(), record["url"]),
            ).fetchone()
            if duplicate:
                continue
            conn.execute(
                """INSERT OR IGNORE INTO evidence
                (claim, source, url, publication_date, source_type, evidence,
                 confidence, related_company, report_section)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                tuple(record.get(field) for field in (
                    "claim", "source", "url", "publication_date", "source_type",
                    "evidence", "confidence", "related_company", "report_section",
                )),
            )
        conn.commit()


def load_evidence_records() -> list[dict]:
    """Read the shared evidence store back from SQLite."""
    with sqlite3.connect(EVIDENCE_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM evidence ORDER BY id").fetchall()
        return [dict(row) for row in rows]


init_evidence_db()

class Week4ResearchState(ResearchState):
    evidence_records: list[dict]

EVIDENCE_SYSTEM_PROMPT = """
You are the evidence extraction step in a business research workflow.

Convert useful specialist research sources into structured Evidence Records.

Return ONLY valid JSON in exactly this shape:
{
  "records": [
    {
      "claim": "...",
      "source": "...",
      "url": "...",
      "publication_date": null,
      "source_type": "web",
      "evidence": "...",
      "confidence": "high",
      "related_company": null,
      "report_section": null
    }
  ]
}

Rules:
- claim = a factual statement directly supported by the source.
- evidence = the passage that supports the claim.
- source and url must come from the supplied Tavily result.
- Do not guess a publication date.
- confidence must be high, medium, or low.
- Do not turn analysis or recommendations into facts.
""".strip()


def is_traceable_passage(record: dict, source_content: str) -> bool:
    """Reject missing quotes and source instructions presented as facts."""
    passage = record.get("evidence", "")
    if not isinstance(passage, str):
        return False
    normalized_passage = " ".join(passage.split()).casefold()
    normalized_content = " ".join(source_content.split()).casefold()
    if not normalized_passage or normalized_passage not in normalized_content:
        return False
    return not re.match(
        r"^(use|consider|review|evaluate|consult|check|ensure)\s+",
        passage.strip(), re.I,
    )


def extract_specialist_evidence(specialist_results: list[dict]) -> list[dict]:
    """Convert specialist source results into the shared Evidence Record format."""
    records = []

    for specialist in specialist_results:
        agent = specialist["agent"]
        objective = specialist["objective"]
        for source in specialist["sources"]:
            source_payload = {
                "agent": agent,
                "objective": objective,
                "title": source.get("title", ""),
                "url": source.get("url", ""),
                "content": source.get("content", ""),
                "published_date": source.get("published_date"),
            }
            if not source_payload["url"] or not source_payload["content"]:
                continue
            prompt = (
                "Extract factual claims from this one Tavily source. Use only its "
                "content; return an empty records list if it supports no claim. "
                "Use the exact source title and URL. Quote the supporting passage "
                "in evidence; do not infer missing dates.\n\n"
                + json.dumps(source_payload, ensure_ascii=False)
            )
            output = call_model_json(EVIDENCE_SYSTEM_PROMPT, prompt)
            extracted = output.get("records", [])
            if not isinstance(extracted, list):
                raise ValueError("Evidence extraction must return a records list.")
            for record in extracted:
                if not isinstance(record, dict):
                    continue
                if not is_traceable_passage(record, source_payload["content"]):
                    continue
                # Source metadata is authoritative; model-generated metadata is not.
                record["source"] = source_payload["title"]
                record["url"] = source_payload["url"]
                record["publication_date"] = source_payload["published_date"]
                records.append(record)

    return records


def validate_shared_evidence(records: list[dict]) -> list[dict]:
    """Validate records and remove exact duplicate claim/source pairs."""
    required = ["claim", "source", "url", "publication_date", "source_type", "evidence"]

    validated = []

    seen = set()
    for record in records:
        if not isinstance(record, dict) or not all(field in record for field in required):
            continue
        if not all(
            isinstance(record[field], str) and record[field].strip()
            for field in ("claim", "source", "url", "source_type", "evidence")
        ):
            continue
        if record.get("confidence") not in ("high", "medium", "low"):
            continue
        key = (record["claim"].lower(), record["url"])
        if key in seen:
            continue
        seen.add(key)
        validated.append(record)

    return validated


def evidence_store_node(state: Week4ResearchState) -> dict:
    """Week 4: build and persist the shared evidence store."""
    records = extract_specialist_evidence(state["specialist_results"])
    validated = validate_shared_evidence(records)
    save_evidence_records(validated)
    return {"evidence_records": validated}


def build_week4_graph():
    """
    Extend the existing Week 3 Team 2 flow:

    Question -> Supervisor -> Specialist Agents -> Evidence Records -> SQLite Store
    """
    graph = StateGraph(Week4ResearchState)

    graph.add_node("supervise", supervisor_node)
    graph.add_node("specialists", specialists_node)
    graph.add_node("evidence_store", evidence_store_node)
    graph.add_edge(START, "supervise")
    graph.add_edge("supervise", "specialists")
    graph.add_edge("specialists", "evidence_store")
    graph.add_edge("evidence_store", END)
    return graph.compile()


week4_graph = build_week4_graph()


# ---------------- Week 4 UI ----------------

st.divider()
st.subheader("Week 4 — Shared Evidence Store")
st.caption("Specialist research → Evidence Records → SQLite Shared Store")

if st.button("Build Shared Evidence Store", type="primary") and question.strip():
    week4_state = {
        "question": question.strip(),
        "assignments": [],
        "specialist_results": [],
        "evidence_records": [],
    }

    try:
        with st.spinner("Running specialists and building the shared evidence store..."):
            evidence_result = week4_graph.invoke(week4_state)
    except Exception as error:
        st.error(f"The Week 4 evidence workflow could not finish: {error}")
    else:
        st.subheader("New Evidence Records")
        st.json(evidence_result["evidence_records"])

        stored_records = load_evidence_records()
        st.subheader("Shared Evidence Store (SQLite)")
        st.dataframe(stored_records, use_container_width=True)
        st.caption(f"{len(stored_records)} evidence records stored in {EVIDENCE_DB}")
"""
ELP WEEK 5 — TEAM 2 — STUDENT CODE
Multi-agent synthesis and report generation

==================== EXACT SETUP INSTRUCTIONS ====================
1. OPEN the SAME Streamlit Python file used for Weeks 3 and 4, for YOUR team.
2. Make sure it already contains, IN THIS ORDER:
     (a) the completed Week 3 application, imports, tools and graphs;
     (b) the completed Week 4 evidence extension, including its Streamlit UI.
3. Scroll to the VERY BOTTOM of that combined file, below the final Week 4
   st.caption(...) / st.dataframe(...) line. Leave two blank lines.
4. COPY EVERYTHING IN THIS WEEK 5 FILE, including its imports, and PASTE there.
   Alternatively, if you already pasted a previous Week 5 extension, REPLACE
   that old Week 5 extension; do NOT append two Week 5 copies.
5. SAVE the combined file. Run it from a terminal with:
     streamlit run YOUR_EXISTING_APP_FILE.py
6. Enter a research question in the existing question input, then click
   Run Full Synthesis Pipeline in the new Week 5 section near the bottom.
7. Check that the output displays a complete 10-section report AND that SQLite
   contains both evidence and a saved report in the 'reports' table.

IMPORTANT DEPENDENCIES:
- This extension is NOT a standalone Python program. It expects Week 3/4 to
  provide sqlite3, json, st, EVIDENCE_DB, question, call_model_json,
  Week4ResearchState, StateGraph, START, END, and the nodes listed below.
- Team 1 reuses: plan_node, research_node, evidence_node.
- Team 2 reuses: supervisor_node, specialists_node, evidence_store_node.
- Complete ALL Week 4 student TODOs first; unfinished Week 4 code prevents
  Week 5 from obtaining evidence.
- DO NOT mix Team 1 and Team 2 files: their graph state and node names differ.
- This week keeps existing SQLite storage. It creates a SECOND table 'reports'
  inside the SAME database file (not a separate database).
- Existing Week 3 and Week 4 UI buttons are preserved. The Week 5 button is
  the one that runs the complete new pipeline end-to-end.
- You will need your existing LLM and search API configuration to make a live run.

STUDENT WORK: Complete TODO 0 through TODO 5 in order. Functions marked pass are exercises and will not work until completed. Use the instructor file only for checking or teaching solutions.

WEEK 5 TARGET: multi-agent Supervisor → Specialists → Shared Evidence → Synthesis → Report
Deliverable: the first complete DRAFT report; automated citation verification and
quality review are deliberately reserved for Week 6.
==================================================================
"""

# UTC timestamp is used when each report is stored in SQLite.
from datetime import datetime, timezone

# ---------------- Week 5: Save reports in SQLite ----------------

# WHAT THIS DOES — DATABASE SETUP: Creates reports table if missing; preserves all Week 4 evidence rows.
def init_report_db():
    with sqlite3.connect(EVIDENCE_DB) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                report_markdown TEXT NOT NULL,
                evidence_count INTEGER NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()


# WHAT THIS DOES — DATABASE WRITE: Saves question, generated markdown, evidence count, timestamp; returns report ID.
def save_report(question: str, report_markdown: str, evidence_count: int) -> int:
    """Save the synthesized report and return its database id."""
    with sqlite3.connect(EVIDENCE_DB) as conn:
        cursor = conn.execute(
            """INSERT INTO reports (question, report_markdown, evidence_count, created_at)
            VALUES (?, ?, ?, ?)""",
            (question, report_markdown, evidence_count, datetime.now(timezone.utc).isoformat()),
        )
        conn.commit()
        return cursor.lastrowid


# WHAT THIS DOES — DATABASE READ: Loads previously generated reports, most recent first, for the UI.
def load_reports() -> list[dict]:
    with sqlite3.connect(EVIDENCE_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM reports ORDER BY id DESC").fetchall()
        return [dict(row) for row in rows]


init_report_db()  # Ensure reports table exists before any report is saved.


# SHARED OUTPUT CONTRACT: Both teams use the SAME nine model-written sections;
# Sources / References is appended in Python as section number ten.
REPORT_SECTION_KEYS = [
    ("executive_summary", "Executive Summary"),
    ("key_findings", "Key Findings"),
    ("competitor_comparison", "Competitor Comparison"),
    ("market_industry_trends", "Market / Industry Trends"),
    ("emerging_technologies", "Emerging Technologies"),
    ("regulatory_developments", "Regulatory Developments"),
    ("risks_opportunities", "Risks / Opportunities"),
    ("recommended_next_steps", "Recommended Next Steps"),
    ("limitations_information_gaps", "Limitations / Information Gaps"),
]


# MODEL INSTRUCTIONS: The model must work from evidence only and return structured JSON.
# Week 6, not this file, handles independent citation validation and report review.
SYNTHESIS_SYSTEM_PROMPT = """
You are the SYNTHESIS AGENT in a multi-agent business research system.

Use ONLY the supplied Shared Evidence Store to create ONE coherent report.
Return ONLY valid JSON with exactly these keys:
{
  "executive_summary": "...",
  "key_findings": "...",
  "competitor_comparison": "...",
  "market_industry_trends": "...",
  "emerging_technologies": "...",
  "regulatory_developments": "...",
  "risks_opportunities": "...",
  "recommended_next_steps": "...",
  "limitations_information_gaps": "..."
}

Rules:
- Cite factual statements using evidence labels such as [E1].
- Reorganize findings by business topic, not agent name.
- The report should read as if one coordinated team produced it.
- Do not invent facts, dates, metrics, source names, URLs, or citations.
- Clearly distinguish facts, analysis, recommendations, and uncertainty.
- If evidence is insufficient, say so.
- Do NOT add the Reviewer/Critic today. That is Week 6.
""".strip()


# WHAT THIS DOES — EVIDENCE PREP: Assigns [E1], [E2] labels to this run’s evidence, keeps sources and excerpts.
def build_evidence_packet(evidence_records: list[dict]) -> list[dict]:
    packet = []
    for index, record in enumerate(evidence_records, start=1):
        packet.append({
            "evidence_id": f"E{index}",
            "claim": record.get("claim"),
            "source": record.get("source"),
            "url": record.get("url"),
            "publication_date": record.get("publication_date"),
            "source_type": record.get("source_type"),
            "evidence": record.get("evidence"),
            "confidence": record.get("confidence"),
            "related_company": record.get("related_company"),
            "report_section": record.get("report_section"),
        })
    return packet


# WHAT THIS DOES — TEAM 2 SYNTHESIS AGENT: Combines all specialist evidence into ONE unified report.
def synthesize_report(question: str, evidence_records: list[dict]) -> dict:
    """Merge all specialist evidence into the common report structure."""
    packet = build_evidence_packet(evidence_records)
    prompt = (
        f"Research question:\n{question}\n\n"
        "Shared Evidence Store (cite the evidence_id labels):\n"
        + json.dumps(packet, ensure_ascii=False, indent=2)
    )
    report = call_model_json(SYNTHESIS_SYSTEM_PROMPT, prompt)
    if not isinstance(report, dict):
        raise ValueError("Synthesis must return a JSON object.")
    for key, _ in REPORT_SECTION_KEYS:
        if not isinstance(report.get(key), str) or not report[key].strip():
            raise ValueError(f"Synthesis is missing report section: {key}")
    return report


# WHAT THIS DOES — REFERENCES: Creates citation legend from original URLs, not invented model references.
def build_references(evidence_records: list[dict]) -> str:
    lines = []
    for index, record in enumerate(evidence_records, start=1):
        source = record.get("source") or "Unknown source"
        url = record.get("url") or "No URL"
        date = record.get("publication_date") or "Date unavailable"
        lines.append(f"- [E{index}] {source} — {date} — {url}")
    return "\n".join(lines) if lines else "No source records were available."


# WHAT THIS DOES — REPORT FORMAT: Assembles nine model sections and the tenth Sources / References section.
def render_report_markdown(report: dict, evidence_records: list[dict]) -> str:
    blocks = ["# DRAFT — Unreviewed research report"]
    for key, title in REPORT_SECTION_KEYS:
        blocks.append(f"## {title}\n\n{report.get(key, '')}")
    blocks.append("## Sources / References\n\n" + build_references(evidence_records))
    return "\n\n".join(blocks)


class Week5ResearchState(Week4ResearchState):
    report: dict
    report_markdown: str
    report_id: int



# WHAT THIS DOES — TEAM 2 GRAPH NODE: Runs synthesis, formats it, saves to SQLite.
def synthesis_node(state: Week5ResearchState) -> dict:
    """Synthesize only after all shared evidence has been produced."""
    evidence_records = state["evidence_records"]
    if not evidence_records:
        raise ValueError("No shared evidence was produced; a report cannot be synthesized.")
    report = synthesize_report(state["question"], evidence_records)
    report_markdown = render_report_markdown(report, evidence_records)
    report_id = save_report(state["question"], report_markdown, len(evidence_records))
    return {"report": report, "report_markdown": report_markdown, "report_id": report_id}


# WHAT THIS DOES — WORKFLOW WIRING: Reuses Week 3/4 nodes and adds Week 5 report/synthesis at the end.
def build_week5_graph():
    """Question -> Supervisor -> Specialists -> Shared Evidence -> Synthesis -> END"""
    graph = StateGraph(Week5ResearchState)
    graph.add_node("supervise", supervisor_node)
    graph.add_node("specialists", specialists_node)
    graph.add_node("evidence_store", evidence_store_node)
    graph.add_node("synthesize", synthesis_node)
    graph.add_edge(START, "supervise")
    graph.add_edge("supervise", "specialists")
    graph.add_edge("specialists", "evidence_store")
    graph.add_edge("evidence_store", "synthesize")
    graph.add_edge("synthesize", END)
    return graph.compile()


week5_graph = build_week5_graph()


# ---------------- Week 5 UI ----------------
# UI: Adds a separate Week 5 button and shows the report + evidence + saved history.
# A full run invokes Week 3 planning/research, Week 4 evidence, THEN Week 5 writing.

st.divider()
st.subheader("Week 5 — Multi-Agent Synthesis Pipeline")
st.caption("Question → Supervisor → Specialists → Shared Evidence → Synthesis Agent → Report")

if st.button("Run Full Synthesis Pipeline", type="primary") and question.strip():
    week5_state: Week5ResearchState = {
        "question": question.strip(),
        "assignments": [],
        "specialist_results": [],
        "evidence_records": [],
        "report": {},
        "report_markdown": "",
        "report_id": 0,
    }
    try:
        with st.spinner("Running research, evidence extraction, and synthesis..."):
            result = week5_graph.invoke(week5_state)
    except Exception as error:
        st.error(f"The Week 5 synthesis workflow could not finish: {error}")
    else:
        st.subheader(f"Draft report #{result['report_id']}")
        st.markdown(result["report_markdown"])
        st.subheader("Evidence used in this report")
        st.dataframe(result["evidence_records"], use_container_width=True)
        st.subheader("Saved report history (SQLite)")
        st.dataframe(load_reports(), use_container_width=True)


"""
ELP Week 6 — Team 2 reviewed synthesis extension

Keep the Week 3–5 workflow above intact. The reviewer uses only the evidence
already collected in the current run, permits one revision, and never treats a
Week 5 SQLite draft as an approved report.
"""

REVIEW_SCORE_KEYS = (
    "completeness", "citation_support", "source_quality", "consistency",
    "business_usefulness", "clarity",
)

REVIEW_SYSTEM_PROMPT = """
You are the independent REVIEWER/CRITIC of a draft business research report.
Use only the research question, draft report, and numbered Shared Evidence Store
supplied below. Check the report's factual claims against those records. Do not
invent evidence or browse for new facts. A label such as [E1] is not sufficient
unless that evidence actually supports the adjacent claim.

Return ONLY a JSON object with exactly these top-level keys:
{
  "overall_status": "PASS or NEEDS_REVISION",
  "scores": {
    "completeness": 0, "citation_support": 0, "source_quality": 0,
    "consistency": 0, "business_usefulness": 0, "clarity": 0
  },
  "issues": [
    {"category": "citation_support", "section": "executive_summary", "explanation": "...", "suggested_fix": "..."}
  ],
  "research_gaps": ["..."]
}

Score each dimension from 0 to 10. Mark unsupported or misleading factual
claims as material citation_support issues. Include specific evidence labels
and claims in feedback. PASS only if every score is at least 7 and there are
no material citation-support issues. If a gap cannot be fixed from the supplied
evidence, put it in research_gaps; do not recommend invented facts.
""".strip()

REVISION_SYSTEM_PROMPT = """
You are revising ONE draft business research report after reviewer feedback.
Use ONLY the supplied numbered Shared Evidence Store, draft, and feedback.
Do not search, invent facts, change evidence labels, or imply gaps were filled
when no supporting evidence exists. Correct or remove unsupported claims.
State unresolved research gaps plainly in limitations_information_gaps.
Return ONLY a JSON object with the same nine section keys as the draft.
""".strip()


def _normalize_review_scores(raw_scores: object) -> dict[str, int]:
    """Reject missing, ambiguous, or out-of-range scores instead of passing them."""
    if not isinstance(raw_scores, dict):
        raise ValueError("Reviewer scores must be a JSON object.")
    if any(key not in raw_scores for key in REVIEW_SCORE_KEYS):
        raise ValueError("Reviewer response is missing a required score.")
    scores = {}
    for key in REVIEW_SCORE_KEYS:
        value = raw_scores[key]
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"Reviewer score {key} must be a number from 0 to 10.")
        if not 0 <= value <= 10 or value != value:  # also rejects NaN
            raise ValueError(f"Reviewer score {key} is outside 0 to 10.")
        scores[key] = int(value)  # conservative normalization: 6.9 does not become 7
    return scores


def _normalize_review_items(raw_items: object, field: str) -> list:
    if not isinstance(raw_items, list):
        raise ValueError(f"Reviewer {field} must be a JSON list.")
    if field == "research_gaps":
        if any(not isinstance(item, str) or not item.strip() for item in raw_items):
            raise ValueError("Reviewer research_gaps must contain nonempty strings.")
    else:
        required = ("category", "section", "explanation", "suggested_fix")
        if any(not isinstance(item, dict) or any(
            not isinstance(item.get(key), str) or not item[key].strip() for key in required
        ) for item in raw_items):
            raise ValueError("Reviewer issues have an invalid shape.")
    return raw_items


def _material_citation_issue(issue: dict) -> bool:
    category = issue["category"].lower().replace("-", "_").replace(" ", "_")
    detail = issue["explanation"].lower()
    citation_related = ("citation" in category or "source_support" in category or
                        any(word in detail for word in ("unsupported", "wrong citation", "misattribut")))
    # The Week 6 issue schema has no severity field, so ambiguous citation issues
    # must remain blocking until the reviewer clears them on the next pass.
    return citation_related


def _unknown_citation_issues(report: dict, evidence_records: list[dict]) -> list[dict]:
    allowed = {f"E{i}" for i in range(1, len(evidence_records) + 1)}
    report_text = "\n".join(report[key] for key, _ in REPORT_SECTION_KEYS)
    used = set(re.findall(r"\[E\d+\]", report_text))
    return [
        {"category": "citation_support", "section": "report",
         "explanation": f"Report cites unknown evidence label {label}.",
         "suggested_fix": "Remove the claim or cite a supporting supplied evidence record."}
        for label in sorted(used) if label[1:-1] not in allowed
    ]


# TODO 0: independent review of the existing nine-section report and evidence.
def review_report(question: str, report: dict, evidence_records: list[dict]) -> dict:
    if not isinstance(report, dict) or any(
        not isinstance(report.get(key), str) or not report[key].strip()
        for key, _ in REPORT_SECTION_KEYS
    ):
        raise ValueError("Reviewer needs a complete nine-section draft report.")
    if not evidence_records:
        raise ValueError("Reviewer needs the current run's shared evidence.")
    prompt = (
        f"Research question:\n{question}\n\n"
        "Draft report (nine model-written sections):\n"
        + json.dumps(report, ensure_ascii=False, indent=2)
        + "\n\nShared Evidence Store (cite these evidence_id labels):\n"
        + json.dumps(build_evidence_packet(evidence_records), ensure_ascii=False, indent=2)
    )
    raw = call_model_json(REVIEW_SYSTEM_PROMPT, prompt)
    if not isinstance(raw, dict) or raw.get("overall_status") not in {"PASS", "NEEDS_REVISION"}:
        raise ValueError("Reviewer returned an invalid JSON object or status.")
    scores = _normalize_review_scores(raw.get("scores"))
    issues = list(_normalize_review_items(raw.get("issues"), "issues"))
    gaps = _normalize_review_items(raw.get("research_gaps"), "research_gaps")
    issues.extend(_unknown_citation_issues(report, evidence_records))
    passed = raw["overall_status"] == "PASS" and all(score >= 7 for score in scores.values()) and not any(
        _material_citation_issue(issue) for issue in issues
    )
    return {
        "overall_status": "PASS" if passed else "NEEDS_REVISION",
        "scores": scores,
        "issues": issues,
        "research_gaps": gaps,
    }


# TODO 1: exactly one evidence-bound revision, with no new research.
def revise_report_once(question: str, report: dict, evidence_records: list[dict], feedback: dict) -> dict:
    prompt = (
        f"Research question:\n{question}\n\n"
        "Draft report:\n" + json.dumps(report, ensure_ascii=False, indent=2)
        + "\n\nReviewer feedback:\n" + json.dumps(feedback, ensure_ascii=False, indent=2)
        + "\n\nShared Evidence Store (only allowed sources):\n"
        + json.dumps(build_evidence_packet(evidence_records), ensure_ascii=False, indent=2)
    )
    revised = call_model_json(REVISION_SYSTEM_PROMPT, prompt)
    if not isinstance(revised, dict) or any(
        not isinstance(revised.get(key), str) or not revised[key].strip()
        for key, _ in REPORT_SECTION_KEYS
    ):
        raise ValueError("Revision did not preserve all nine report sections.")
    return {key: revised[key] for key, _ in REPORT_SECTION_KEYS}


# TODO 2: Week 6 adds review state without removing any Week 5 fields.
class Week6ResearchState(Week5ResearchState):
    review: dict
    initial_review: dict
    final_report_markdown: str
    revision_performed: bool


# TODO 3: review, revise at most once, then review that revision once more.
def reviewer_node(state: Week6ResearchState) -> dict:
    report = state["report"]
    evidence_records = state["evidence_records"]
    initial = review_report(state["question"], report, evidence_records)
    revised = False
    final_review = initial
    if initial["overall_status"] != "PASS":
        report = revise_report_once(state["question"], report, evidence_records, initial)
        revised = True
        final_review = review_report(state["question"], report, evidence_records)
    markdown = render_report_markdown(report, evidence_records)
    if final_review["overall_status"] == "PASS":
        markdown = markdown.replace(
            "# DRAFT — Unreviewed research report",
            "# REVIEWED — Prototype-approved research report", 1,
        )
    else:
        markdown = markdown.replace(
            "# DRAFT — Unreviewed research report",
            "# UNAPPROVED DRAFT — Reviewer criteria not met", 1,
        )
    return {
        "report": report,
        "review": final_review,
        "initial_review": initial,
        "final_report_markdown": markdown,
        "revision_performed": revised,
    }


# TODO 4: the Week 3–5 nodes stay in order; Week 6 adds one reviewer node.
def build_week6_graph():
    graph = StateGraph(Week6ResearchState)
    graph.add_node("supervise", supervisor_node)
    graph.add_node("specialists", specialists_node)
    graph.add_node("evidence_store", evidence_store_node)
    graph.add_node("synthesize", synthesis_node)
    graph.add_node("reviewer", reviewer_node)
    graph.add_edge(START, "supervise")
    graph.add_edge("supervise", "specialists")
    graph.add_edge("specialists", "evidence_store")
    graph.add_edge("evidence_store", "synthesize")
    graph.add_edge("synthesize", "reviewer")
    graph.add_edge("reviewer", END)
    return graph.compile()


week6_graph = build_week6_graph()


# TODO 5: only a passing review releases the final report in the UI.
def display_week6_result(result: dict) -> None:
    """Show an unapproved report only within its inspection expander."""
    review = result["review"]
    st.subheader("Reviewer scorecard")
    st.dataframe(
        [{"Dimension": key.replace("_", " ").title(), "Score / 10": review["scores"][key]}
         for key in REVIEW_SCORE_KEYS],
        width="stretch",
    )
    st.subheader("Issues")
    st.json(review["issues"])
    st.subheader("Research gaps")
    st.json(review["research_gaps"])
    if result["revision_performed"]:
        with st.expander("Initial review before the single revision"):
            st.json(result["initial_review"])
    if review["overall_status"] == "PASS":
        st.success("The report passed the prototype reviewer gate.")
        st.markdown(result["final_report_markdown"])
    else:
        st.error("The report remains an unapproved draft after one revision.")
        with st.expander("Unapproved draft — for review only"):
            st.markdown(result["final_report_markdown"])
    st.subheader("Shared evidence used in this run")
    st.dataframe(result["evidence_records"], width="stretch")


st.divider()
st.subheader("Week 6 — Reviewed Synthesis Pipeline")
st.caption("Supervisor → Specialists → Shared Evidence → Synthesis → Reviewer/Critic")
st.caption("Prototype review checks the supplied evidence; it does not guarantee factual correctness.")

if st.button("Run Reviewed Synthesis Pipeline", type="primary") and question.strip():
    week6_state: Week6ResearchState = {
        "question": question.strip(),
        "assignments": [], "specialist_results": [], "evidence_records": [],
        "report": {}, "report_markdown": "", "report_id": 0,
        "review": {}, "initial_review": {}, "final_report_markdown": "",
        "revision_performed": False,
    }
    try:
        with st.spinner("Running research, synthesis, and one review cycle..."):
            result = week6_graph.invoke(week6_state)
    except Exception as error:
        st.error(f"The reviewed pipeline could not finish; no report was approved: {error}")
    else:
        display_week6_result(result)


"""ELP Week 7 — Team 2: one bounded gap and conflict research pass."""

W7_T2_GAP_PROMPT = """
You are the existing supervisor's GAP AND CONFLICT CHECK, not a new agent.
Given the user's research question and evidence store, identify at most ONE
material research gap or meaningful contradiction that targeted research could fix.
Return JSON ONLY:
  {"needs_research": boolean, "reason": string,
   "targeted_question": string, "conflicts": [string], "gaps": [string]}
Missing evidence and genuinely conflicting facts matter; duplicate coverage
alone does not require searching. Do not invent missing facts or resolve a
conflict by guessing. Recommend NO further research when already adequate.
""".strip()


def week7_t2_find_gaps(state: dict) -> dict:
    """Fail closed on malformed gap checks so they cannot cause extra searches."""
    prompt = (
        f"Original research question:\n{state['question']}\n\n"
        "Shared Evidence Store:\n"
        + json.dumps(build_evidence_packet(state["evidence_records"]), ensure_ascii=False, indent=2)
    )
    raw = call_model_json(W7_T2_GAP_PROMPT, prompt)
    valid = isinstance(raw, dict) and type(raw.get("needs_research")) is bool
    if valid:
        valid = all(isinstance(raw.get(key), str) for key in ("reason", "targeted_question"))
        valid = valid and all(
            isinstance(raw.get(key), list)
            and all(isinstance(item, str) and item.strip() for item in raw[key])
            for key in ("conflicts", "gaps")
        )
        valid = valid and len(raw["conflicts"]) + len(raw["gaps"]) <= 1
    if not valid:
        check = {
            "needs_research": False, "reason": "Invalid gap check; no additional research was authorized.",
            "targeted_question": "", "conflicts": [], "gaps": [],
        }
    else:
        check = {key: raw[key] for key in (
            "needs_research", "reason", "targeted_question", "conflicts", "gaps"
        )}
        if check["needs_research"] and not (
            check["reason"].strip() and check["targeted_question"].strip()
            and (check["conflicts"] or check["gaps"])
        ):
            check["needs_research"] = False
            check["reason"] = "No actionable material gap or conflict was identified."
            check["targeted_question"] = ""
    return {"gap_check": check, "additional_research_performed": False}


def week7_t2_route(state: dict) -> str:
    check = state.get("gap_check", {})
    if (isinstance(check, dict) and check.get("needs_research") is True
            and isinstance(check.get("reason"), str) and check["reason"].strip()
            and isinstance(check.get("targeted_question"), str)
            and check["targeted_question"].strip()
            and any(isinstance(check.get(key), list)
                    and all(isinstance(item, str) and item.strip() for item in check[key])
                    and check[key]
                    for key in ("conflicts", "gaps"))):
        return "additional"
    return "synthesis"


def week7_t2_additional_research(state: dict) -> dict:
    """Run the existing three specialists once and merge their validated evidence."""
    target = state["gap_check"]["targeted_question"].strip()
    targeted_state = {**state, "question": target}
    assignments = supervisor_node(targeted_state)["assignments"]
    targeted_state["assignments"] = assignments
    new_results = specialists_node(targeted_state)["specialist_results"]
    targeted_state["specialist_results"] = new_results
    new_records = evidence_store_node(targeted_state)["evidence_records"]
    old_records = list(state["evidence_records"])
    merged = validate_shared_evidence(old_records + new_records)
    return {
        "evidence_records": merged,
        "specialist_results": list(state["specialist_results"]) + new_results,
        "additional_research_performed": True,
        "new_evidence_count": len(merged) - len(old_records),
    }


class Week7ResearchState(Week6ResearchState):
    gap_check: dict
    additional_research_performed: bool
    new_evidence_count: int


def build_week7_graph():
    graph = StateGraph(Week7ResearchState)
    graph.add_node("supervise", supervisor_node)
    graph.add_node("specialists", specialists_node)
    graph.add_node("evidence_store", evidence_store_node)
    graph.add_node("gap_check", week7_t2_find_gaps)
    graph.add_node("additional", week7_t2_additional_research)
    graph.add_node("synthesize", synthesis_node)
    graph.add_node("reviewer", reviewer_node)
    graph.add_edge(START, "supervise")
    graph.add_edge("supervise", "specialists")
    graph.add_edge("specialists", "evidence_store")
    graph.add_edge("evidence_store", "gap_check")
    graph.add_conditional_edges("gap_check", week7_t2_route, {
        "additional": "additional", "synthesis": "synthesize",
    })
    graph.add_edge("additional", "synthesize")
    graph.add_edge("synthesize", "reviewer")
    graph.add_edge("reviewer", END)
    return graph.compile()


week7_graph = build_week7_graph()

st.divider()
st.subheader("Week 7 — Interactive Research Loop")
st.caption("Gap and conflict check → at most one targeted research pass → synthesis → review")
if st.button("Run Week 7 Research Loop", type="primary") and question.strip():
    week7_state: Week7ResearchState = {
        "question": question.strip(),
        "assignments": [], "specialist_results": [], "evidence_records": [],
        "report": {}, "report_markdown": "", "report_id": 0,
        "review": {}, "initial_review": {}, "final_report_markdown": "",
        "revision_performed": False,
        "gap_check": {}, "additional_research_performed": False,
        "new_evidence_count": 0,
    }
    try:
        with st.spinner("Checking gaps, researching if needed, and reviewing the report..."):
            result = week7_graph.invoke(week7_state)
    except Exception as error:
        st.error(f"The Week 7 research loop could not finish; no report was approved: {error}")
    else:
        st.subheader("Gap and conflict check")
        st.json(result["gap_check"])
        st.write("Additional research performed:", result["additional_research_performed"])
        st.write("New evidence records:", result["new_evidence_count"])
        display_week6_result(result)
