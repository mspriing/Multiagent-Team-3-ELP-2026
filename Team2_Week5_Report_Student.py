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
==================================================================
"""

from datetime import datetime, timezone
import json
import os
import sqlite3
from typing import TypedDict

import streamlit as st
from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from Team2_Week4_Evidence_Student import EVIDENCE_DB, Week4ResearchState, evidence_store_node
from team2_week3_student import call_model_json, specialists_node, supervisor_node

# ---------------- Week 5: Save reports in SQLite ----------------

def init_report_db():
    """Create the reports table if missing; preserves all Week 4 evidence rows."""
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


def save_report(question: str, report_markdown: str, evidence_count: int) -> int:
    """Save the synthesized report and return its database id."""
    with sqlite3.connect(EVIDENCE_DB) as conn:
        cursor = conn.execute("""
            INSERT INTO reports (question, report_markdown, evidence_count, created_at)
            VALUES (?, ?, ?, ?)
        """, (question, report_markdown, evidence_count, datetime.now(timezone.utc).isoformat()))
        conn.commit()
        return cursor.lastrowid


def load_reports() -> list[dict]:
    """Load previously generated reports, most recent first, for the UI."""
    with sqlite3.connect(EVIDENCE_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM reports ORDER BY id DESC").fetchall()
        return [dict(row) for row in rows]


init_report_db()


# SHARED OUTPUT CONTRACT
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


def build_evidence_packet(evidence_records: list[dict]) -> list[dict]:
    """Assign [E1], [E2] labels to evidence records."""
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


def synthesize_report(question: str, evidence_records: list[dict]) -> dict:
    """Merge all specialist evidence into the common report structure."""
    evidence_packet = build_evidence_packet(evidence_records)
    prompt = f"Research Question: {question}\n\nShared Evidence:\n{evidence_packet}"
    report = call_model_json(SYNTHESIS_SYSTEM_PROMPT, prompt) or {}
    
    # Ensure all keys exist in the report, even if empty.
    for key, _ in REPORT_SECTION_KEYS:
        report.setdefault(key, "")
    return report


def build_references(evidence_records: list[dict]) -> str:
    """Create citation legend from original URLs."""
    lines = []
    for index, record in enumerate(evidence_records, start=1):
        source = record.get("source") or "Unknown source"
        url = record.get("url") or "No URL"
        date = record.get("publication_date") or "Date unavailable"
        lines.append(f"- [E{index}] {source} — {date} — {url}")
    return "\n".join(lines) if lines else "No source records were available."


def render_report_markdown(report: dict, evidence_records: list[dict]) -> str:
    """Assemble nine model sections and the tenth Sources / References section."""
    blocks = []
    for key, title in REPORT_SECTION_KEYS:
        blocks.append(f"## {title}\n\n{report.get(key, '')}")
    blocks.append("## Sources / References\n\n" + build_references(evidence_records))
    return "\n\n".join(blocks)


# TODO 2 — WEEK 5 STATE
class Week5ResearchState(Week4ResearchState):
    report: dict
    report_markdown: str
    report_id: int


def synthesis_node(state: Week5ResearchState) -> dict:
    """Synthesize only after all shared evidence has been produced."""
    evidence_records = state.get("evidence_records", [])
    if not evidence_records:
        raise ValueError("No evidence records found. Cannot synthesize report.")
    
    synthesized_report = synthesize_report(state.get("question", ""), evidence_records)
    report_markdown = render_report_markdown(synthesized_report, evidence_records)
    report_id = save_report(state.get("question", ""), report_markdown, len(evidence_records))
    
    return {
        "report": synthesized_report,
        "report_markdown": report_markdown,
        "report_id": report_id
    }


def build_week5_graph() -> CompiledStateGraph:
    """Question -> Supervisor -> Specialists -> Shared Evidence -> Synthesis -> END"""
    graph = StateGraph(Week5ResearchState)
    graph.add_node("supervise", supervisor_node)
    graph.add_node("specialists", specialists_node)
    graph.add_node("evidence_store", evidence_store_node)
    graph.add_node("synthesis", synthesis_node)
    
    graph.add_edge(START, "supervise")
    graph.add_edge("supervise", "specialists")
    graph.add_edge("specialists", "evidence_store")
    graph.add_edge("evidence_store", "synthesis")
    graph.add_edge("synthesis", END)
    
    return graph.compile()


week5_graph = build_week5_graph()


# ---------------- Week 5 UI ----------------

st.divider()
st.subheader("Week 5 — Multi-Agent Synthesis Pipeline")
st.caption("Question → Supervisor → Specialists → Shared Evidence → Synthesis Agent → Report")

# Define or reuse the input field
if "question" not in locals() or not question:
    question = st.text_area("Enter a research question for the synthesis pipeline", height=100, key="week5_question")

if st.button("Run Full Synthesis Pipeline", type="primary") and question.strip():
    week5_state = {
        "question": question.strip(),
        "assignments": [],
        "specialist_results": [],
        "evidence_records": [],
        "report": {},
        "report_markdown": "",
        "report_id": None,
    }

    try:
        with st.spinner("Running supervisor, specialists, evidence extraction, and report synthesis..."):
            synthesis_result = week5_graph.invoke(week5_state)
    except Exception as error:
        st.error(f"The Week 5 synthesis pipeline could not finish: {error}")
    else:
        st.subheader("Synthesized Report (10 Sections)")
        st.markdown(synthesis_result["report_markdown"])

        st.subheader("Shared Evidence Used")
        st.dataframe(synthesis_result["evidence_records"], width="stretch")

        saved_reports = load_reports()
        st.subheader("Saved Reports History (SQLite)")
        st.dataframe(saved_reports, width="stretch")
        st.caption(f"Report ID #{synthesis_result['report_id']} saved to 'reports' table in {EVIDENCE_DB}")