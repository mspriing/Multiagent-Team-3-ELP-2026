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
