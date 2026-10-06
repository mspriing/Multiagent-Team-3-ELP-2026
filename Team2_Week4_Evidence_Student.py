"""
ELP Week 4 — Team 2 Student Extension
Evidence & Traceability + SQLite

PASTE THIS FILE BELOW THE EXISTING Week 3 Team 2 CODE.

Do not replace your Week 3 code. This file adds the Week 4 shared evidence
layer and stores the shared evidence store in a small SQLite database.
"""

# ---------------- Week 4: Shared Evidence Store ----------------

import sqlite3

from team2_week3_student import ResearchState, call_model_json, specialists_node, supervisor_node
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import TypedDict

import streamlit as st
from dotenv import load_dotenv
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph
from openai import OpenAI
from tavily import TavilyClient


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
    # TODO 0 — SAVE TO SQLITE
    #
    # Insert each record into the evidence table using parameterized SQL.
    # Use INSERT OR IGNORE so the same claim + URL is not stored twice.
    with sqlite3.connect(EVIDENCE_DB) as conn:
        for record in records:
            conn.execute("""
                INSERT OR IGNORE INTO evidence (
                    claim, source, url, publication_date, source_type,
                    evidence, confidence, related_company, report_section
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                record.get("claim"),
                record.get("source"),
                record.get("url"),
                record.get("publication_date"),
                record.get("source_type"),
                record.get("evidence"),
                record.get("confidence"),
                record.get("related_company"),
                record.get("report_section")
            ))
        conn.commit()


def load_evidence_records() -> list[dict]:
    """Read the shared evidence store back from SQLite."""
    with sqlite3.connect(EVIDENCE_DB) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM evidence ORDER BY id").fetchall()
        return [dict(row) for row in rows]


init_evidence_db()

# TODO 1 — WEEK 4 STATE
#
# Extend the existing Week 3 ResearchState with:
#     evidence_records: list[dict]
#
# Hint:
#     class Week4ResearchState(ResearchState):
#         ...

class Week4ResearchState(ResearchState):
    question: str
    assignments: list[dict]
    specialist_results: list[dict]
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


def extract_specialist_evidence(specialist_results: list[dict]) -> list[dict]:
    """Convert specialist source results into the shared Evidence Record format."""
    records = []

    # TODO 2 — EVIDENCE EXTRACTION
    #
    # For each specialist in specialist_results:
    #   1. Read agent and objective.
    #   2. Loop through specialist["sources"].
    #   3. Build source_payload with:
    #        agent, objective, title, url, content, published_date
    #   4. Call call_model_json(EVIDENCE_SYSTEM_PROMPT, prompt).
    #   5. Add every returned record to records.
    #
    # Every specialist must produce the SAME Evidence Record structure.
    for specialist in specialist_results:
        agent = specialist.get("agent")
        objective = specialist.get("objective")
        sources = specialist.get("sources", [])

        for source in sources:
            title = source.get("title")
            url = source.get("url")
            content = source.get("content")
            published_date = source.get("published_date")

            source_payload = {
                "agent": agent,
                "objective": objective,
                "title": title,
                "url": url,
                "content": content,
                "published_date": published_date
            }

            prompt = f"Extract evidence from the following source:\n{source_payload}"
            response = call_model_json(EVIDENCE_SYSTEM_PROMPT, prompt)

            if response and isinstance(response, dict):
                extracted_records = response.get("records", [])
                records.extend(extracted_records)

    return records


def validate_shared_evidence(records: list[dict]) -> list[dict]:
    """Validate records and remove exact duplicate claim/source pairs."""
    required = ["claim", "source", "url", "publication_date", "source_type", "evidence"]

    validated = []

    # TODO 3 — VALIDATION + DUPLICATES
    #
    # Keep only dictionaries with non-empty:
    #   claim, source, url, source_type, evidence
    #
    # Remove exact duplicates using:
    #   (claim.lower(), url)
    #
    # Hint: use a set called seen.
    seen = set()
    for record in records:
        if all(record.get(field) for field in required):
            key = (record["claim"].lower(), record["url"])
            if key not in seen:
                seen.add(key)
                validated.append(record)

    return validated


def evidence_store_node(state: ResearchState) -> dict:
    """Week 4: build and persist the shared evidence store."""
    # TODO 4 — CONNECT SPECIALISTS TO SHARED STORE + DATABASE
    #
    # 1. Extract records from state["specialist_results"].
    # 2. Validate them.
    # 3. Save validated records to SQLite.
    # 4. Return {"evidence_records": ...}.
    specialist_results = state.get("specialist_results", [])
    extracted_records = extract_specialist_evidence(specialist_results)
    validated_records = validate_shared_evidence(extracted_records)
    save_evidence_records(validated_records)
    return {"evidence_records": validated_records}


def build_week4_graph() -> CompiledStateGraph:
    """
    Extend the existing Week 3 Team 2 flow:

    Question -> Supervisor -> Specialist Agents -> Evidence Records -> SQLite Store
    """
    graph = StateGraph(Week4ResearchState)

    graph.add_node("supervise", supervisor_node)
    graph.add_node("specialists", specialists_node)
    graph.add_node("evidence_store", evidence_store_node)

    # Connect the Week 4 workflow
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
question = st.text_area("Enter a research question for the specialists", height=100)

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
