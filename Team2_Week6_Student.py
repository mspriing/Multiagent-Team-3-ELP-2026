"""
===============================================================
ELP WEEK 6 — TEAM 2 — STUDENT CODE
Multi-Agent Reviewer / Quality Control
===============================================================

This Week 6 extension is designed to be pasted BELOW Week 5
in the existing Team 2 Streamlit application.

Pipeline:

Question
    ↓
Supervisor
    ↓
Specialists
    ↓
Shared Evidence Store
    ↓
Synthesis Agent
    ↓
Reviewer
    ↓
    ├── PASS → Final Report
    │
    └── NEEDS_REVISION
            ↓
        One Controlled Revision
            ↓
        Reviewer Again
            ↓
        Final Verdict

Week 6 does NOT perform additional research.
Maximum revisions = 1.
===============================================================
"""

import json

import streamlit as st

from langgraph.graph import StateGraph, START, END

from Team2_Week4_Evidence_Student import evidence_store_node

from Team2_Week5_Report_Student import (
    REPORT_SECTION_KEYS,
    Week5ResearchState,
    build_evidence_packet,
    render_report_markdown,
    synthesis_node,
)

from team2_week3_student import (
    call_model_json,
    specialists_node,
    supervisor_node,
)


# ===============================================================
# WEEK 6 — REVIEWER SYSTEM PROMPT
# ===============================================================

REVIEW_SYSTEM_PROMPT = """
You are the REVIEWER / CRITIC AGENT in a multi-agent business
research system.

Evaluate the draft report against:

1. The research question
2. The supplied Shared Evidence Store
3. The report's citations
4. The quality and usefulness of the report

Do NOT conduct new research.

Do NOT silently rewrite the report.

Return ONLY valid JSON in exactly this structure:

{
  "overall_status": "PASS" or "NEEDS_REVISION",
  "scores": {
    "completeness": 0,
    "citation_support": 0,
    "source_quality": 0,
    "consistency": 0,
    "business_usefulness": 0,
    "clarity": 0
  },
  "issues": [
    {
      "category": "completeness | citation_support | source_quality | consistency | business_usefulness | clarity",
      "section": "report section or overall",
      "explanation": "specific problem",
      "suggested_fix": "specific bounded fix"
    }
  ],
  "research_gaps": [
    "gap that may require more research later"
  ]
}

Scoring rules:

- Each score must be an integer from 0 to 10.
- PASS requires ALL six scores to be at least 7.
- PASS is NOT allowed if there is a material citation-support problem.
- If evidence is insufficient to support an important claim,
  identify that as an issue.
- Do not give credit for facts that are not supported by the
  supplied evidence.
- Do not invent missing evidence.
- Do not perform additional research.

The reviewer is evaluating the report, not rewriting it.
""".strip()


# ===============================================================
# WEEK 6 — REVISION SYSTEM PROMPT
# ===============================================================

REVISION_SYSTEM_PROMPT = """
You are the SYNTHESIS AGENT performing ONE controlled revision
after reviewer feedback.

Use ONLY:

1. The original research question
2. The current draft report
3. The reviewer feedback
4. The supplied Shared Evidence Store

Do NOT conduct new research.

Do NOT invent facts.

Do NOT invent sources.

Do NOT invent URLs.

Do NOT invent citations.

You may improve:

- organization
- wording
- clarity
- citation placement
- explanation of uncertainty
- alignment with reviewer feedback
- removal of unsupported claims

If a reviewer identifies a research gap that cannot be fixed
using the supplied evidence, acknowledge that limitation in
the limitations section.

Return ONLY valid JSON using exactly the same nine-section
report structure used by Week 5:

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
""".strip()


# ===============================================================
# TODO 0 — REVIEWER AGENT
# ===============================================================

def review_report(
    question: str,
    report: dict,
    evidence_records: list[dict],
) -> dict:
    """
    Review the Week 5 synthesized report.

    The reviewer receives:
        - research question
        - draft report
        - shared evidence

    Invalid reviewer output is treated as NEEDS_REVISION.
    """

    evidence_packet = build_evidence_packet(
        evidence_records
    )

    review_prompt = f"""
Research Question:
{question}

==================================================
DRAFT REPORT
==================================================

{json.dumps(report, indent=2)}

==================================================
SHARED EVIDENCE
==================================================

{json.dumps(evidence_packet, indent=2)}

==================================================
TASK
==================================================

Evaluate the draft report using ONLY the supplied evidence.

Check:

- completeness
- citation support
- source quality
- consistency
- business usefulness
- clarity

Return ONLY the JSON format requested by the reviewer
system prompt.
"""

    json_response = call_model_json(
        REVIEW_SYSTEM_PROMPT,
        review_prompt,
    )

    # -----------------------------------------------------------
    # Invalid JSON / invalid model output
    # -----------------------------------------------------------

    if not isinstance(json_response, dict):

        return {
            "overall_status": "NEEDS_REVISION",

            "scores": {
                "completeness": 0,
                "citation_support": 0,
                "source_quality": 0,
                "consistency": 0,
                "business_usefulness": 0,
                "clarity": 0,
            },

            "issues": [
                {
                    "category": "clarity",
                    "section": "overall",
                    "explanation": (
                        "The reviewer returned invalid JSON "
                        "or an invalid response structure."
                    ),
                    "suggested_fix": (
                        "Run the reviewer again."
                    ),
                }
            ],

            "research_gaps": [],
        }

    # -----------------------------------------------------------
    # Required score categories
    # -----------------------------------------------------------

    required_scores = [
        "completeness",
        "citation_support",
        "source_quality",
        "consistency",
        "business_usefulness",
        "clarity",
    ]

    raw_scores = json_response.get(
        "scores",
        {}
    )

    if not isinstance(raw_scores, dict):
        raw_scores = {}

    scores = {}

    for key in required_scores:

        try:
            score = int(
                raw_scores.get(
                    key,
                    0
                )
            )

        except (TypeError, ValueError):

            score = 0

        # Clamp score between 0 and 10.
        score = max(
            0,
            min(
                10,
                score
            )
        )

        scores[key] = score

    # -----------------------------------------------------------
    # Validate overall status
    # -----------------------------------------------------------

    overall_status = json_response.get(
        "overall_status",
        "NEEDS_REVISION"
    )

    if overall_status not in {
        "PASS",
        "NEEDS_REVISION",
    }:

        overall_status = "NEEDS_REVISION"

    # -----------------------------------------------------------
    # PASS requires every score >= 7
    # -----------------------------------------------------------

    if any(
        score < 7
        for score in scores.values()
    ):

        overall_status = "NEEDS_REVISION"

    # -----------------------------------------------------------
    # Get issues
    # -----------------------------------------------------------

    issues = json_response.get(
        "issues",
        []
    )

    if not isinstance(
        issues,
        list
    ):

        issues = []

    # -----------------------------------------------------------
    # If there is a citation-support issue, do not blindly PASS.
    # -----------------------------------------------------------

    for issue in issues:

        if isinstance(
            issue,
            dict
        ):

            category = issue.get(
                "category",
                ""
            )

            if category == "citation_support":

                overall_status = "NEEDS_REVISION"

    # -----------------------------------------------------------
    # Get research gaps
    # -----------------------------------------------------------

    research_gaps = json_response.get(
        "research_gaps",
        []
    )

    if not isinstance(
        research_gaps,
        list
    ):

        research_gaps = []

    # -----------------------------------------------------------
    # Return normalized reviewer result
    # -----------------------------------------------------------

    return {
        "overall_status": overall_status,
        "scores": scores,
        "issues": issues,
        "research_gaps": research_gaps,
    }


# ===============================================================
# TODO 1 — ONE CONTROLLED REVISION
# ===============================================================

def revise_report_once(
    question: str,
    report: dict,
    evidence_records: list[dict],
    review: dict,
) -> dict:
    """
    Perform exactly ONE controlled revision.

    The revision can only use existing evidence.
    """

    evidence_packet = build_evidence_packet(
        evidence_records
    )

    revision_prompt = f"""
Research Question:
{question}

==================================================
CURRENT DRAFT REPORT
==================================================

{json.dumps(report, indent=2)}

==================================================
REVIEWER FEEDBACK
==================================================

{json.dumps(review, indent=2)}

==================================================
SHARED EVIDENCE
==================================================

{json.dumps(evidence_packet, indent=2)}

==================================================
REVISION INSTRUCTIONS
==================================================

Perform ONE controlled revision of the report.

Use ONLY the supplied shared evidence.

Do NOT:

- conduct new research
- invent facts
- invent statistics
- invent dates
- invent sources
- invent URLs
- invent citations

You MAY:

- improve organization
- improve clarity
- improve wording
- remove unsupported claims
- clarify uncertainty
- improve citation placement
- address reviewer issues when the existing evidence supports
  the requested change

If a reviewer-requested change cannot be supported by the
existing evidence, acknowledge the limitation instead.

Return ONLY valid JSON with the same nine report sections
used by Week 5.
"""

    json_response = call_model_json(
        REVISION_SYSTEM_PROMPT,
        revision_prompt,
    )

    # -----------------------------------------------------------
    # Invalid response
    # -----------------------------------------------------------

    if not isinstance(
        json_response,
        dict
    ):

        json_response = {}

    # -----------------------------------------------------------
    # Ensure all report sections exist
    # -----------------------------------------------------------

    for key, _ in REPORT_SECTION_KEYS:

        json_response.setdefault(
            key,
            ""
        )

    return json_response


# ===============================================================
# TODO 2 — WEEK 6 STATE
# ===============================================================

class Week6ResearchState(
    Week5ResearchState
):
    """
    Extends the Week 5 state with reviewer information.
    """

    review: dict
    initial_review: dict
    final_report_markdown: str
    revision_performed: bool


# ===============================================================
# TODO 3 — REVIEW GATE NODE
# ===============================================================

def reviewer_node(
    state: Week6ResearchState
) -> dict:
    """
    Review the Week 5 report.

    If PASS:
        Keep the original report.

    If NEEDS_REVISION:
        Perform exactly one revision.

    Then:
        Review the revised report exactly once.
    """

    question = state.get(
        "question",
        ""
    )

    report = state.get(
        "report",
        {}
    )

    evidence_records = state.get(
        "evidence_records",
        []
    )

    # -----------------------------------------------------------
    # Initial review
    # -----------------------------------------------------------

    initial_review = review_report(
        question,
        report,
        evidence_records,
    )

    # -----------------------------------------------------------
    # PASS immediately
    # -----------------------------------------------------------

    if initial_review.get(
        "overall_status"
    ) == "PASS":

        final_report = report

        revision_performed = False

        final_review = initial_review

    # -----------------------------------------------------------
    # NEEDS REVISION
    # -----------------------------------------------------------

    else:

        revised_report = revise_report_once(
            question,
            report,
            evidence_records,
            initial_review,
        )

        # Review the revised report exactly once.
        final_review = review_report(
            question,
            revised_report,
            evidence_records,
        )

        final_report = revised_report

        revision_performed = True

    # -----------------------------------------------------------
    # Render final report
    # -----------------------------------------------------------

    final_report_markdown = render_report_markdown(
        final_report,
        evidence_records,
    )

    return {
        "review": final_review,
        "initial_review": initial_review,
        "final_report_markdown": final_report_markdown,
        "revision_performed": revision_performed,
    }


# ===============================================================
# TODO 4 — WEEK 6 GRAPH
# ===============================================================

def build_week6_graph():
    """
    Week 6 pipeline:

    START
      ↓
    Supervisor
      ↓
    Specialists
      ↓
    Evidence Store
      ↓
    Synthesis
      ↓
    Reviewer
      ↓
    END
    """

    graph = StateGraph(
        Week6ResearchState
    )

    # -----------------------------------------------------------
    # Nodes
    # -----------------------------------------------------------

    graph.add_node(
        "supervise",
        supervisor_node
    )

    graph.add_node(
        "specialists",
        specialists_node
    )

    graph.add_node(
        "evidence_store",
        evidence_store_node
    )

    graph.add_node(
        "synthesis",
        synthesis_node
    )

    graph.add_node(
        "reviewer",
        reviewer_node
    )

    # -----------------------------------------------------------
    # Edges
    # -----------------------------------------------------------

    graph.add_edge(
        START,
        "supervise"
    )

    graph.add_edge(
        "supervise",
        "specialists"
    )

    graph.add_edge(
        "specialists",
        "evidence_store"
    )

    graph.add_edge(
        "evidence_store",
        "synthesis"
    )

    graph.add_edge(
        "synthesis",
        "reviewer"
    )

    graph.add_edge(
        "reviewer",
        END
    )

    # -----------------------------------------------------------
    # Compile ONCE
    # -----------------------------------------------------------

    return graph.compile()


week6_graph = build_week6_graph()


# ===============================================================
# TODO 5 — WEEK 6 UI
# ===============================================================

st.divider()

st.subheader(
    "Week 6 — Multi-Agent Reviewer / Quality Control"
)

st.caption(
    "Question → Supervisor → Specialists → Shared Evidence → "
    "Synthesis → Reviewer → Optional One-Time Revision → Final Report"
)


# ---------------------------------------------------------------
# Reuse Week 5 question if available
# ---------------------------------------------------------------

week6_question = st.session_state.get(
    "week5_question",
    ""
)


# ---------------------------------------------------------------
# If no Week 5 question exists, create a Week 6 question input
# ---------------------------------------------------------------

if not week6_question:

    week6_question = st.text_area(
        "Enter a research question for the reviewed synthesis pipeline",
        height=100,
        key="week6_question",
    )


# ---------------------------------------------------------------
# Run button
# ---------------------------------------------------------------

if (
    st.button(
        "Run Reviewed Synthesis Pipeline",
        type="primary"
    )
    and week6_question.strip()
):

    # -----------------------------------------------------------
    # Initial Week 6 state
    # -----------------------------------------------------------

    week6_state = {

        "question": week6_question.strip(),

        "assignments": [],

        "specialist_results": [],

        "evidence_records": [],

        "report": {},

        "report_markdown": "",

        "report_id": None,

        "review": {},

        "initial_review": {},

        "final_report_markdown": "",

        "revision_performed": False,
    }

    # -----------------------------------------------------------
    # Run graph
    # -----------------------------------------------------------

    try:

        with st.spinner(
            "Running research, synthesis, reviewer, "
            "and quality-control pipeline..."
        ):

            result = week6_graph.invoke(
                week6_state
            )

    except Exception as error:

        st.error(
            "The Week 6 reviewed synthesis pipeline "
            f"could not finish: {error}"
        )

    else:

        # =======================================================
        # REVIEW RESULTS
        # =======================================================

        review = result.get(
            "review",
            {}
        )

        status = review.get(
            "overall_status",
            "NEEDS_REVISION"
        )

        scores = review.get(
            "scores",
            {}
        )

        issues = review.get(
            "issues",
            []
        )

        research_gaps = review.get(
            "research_gaps",
            []
        )

        # =======================================================
        # REVIEWER VERDICT
        # =======================================================

        st.subheader(
            "Reviewer Verdict"
        )

        if status == "PASS":

            st.success(
                "PASS — The report passed the Week 6 "
                "quality-control gate."
            )

        else:

            st.error(
                "NEEDS REVISION — The report did not pass "
                "the Week 6 quality-control gate."
            )

        # -------------------------------------------------------
        # Revision status
        # -------------------------------------------------------

        if result.get(
            "revision_performed"
        ):

            st.info(
                "One controlled revision was performed using "
                "existing evidence only."
            )

        else:

            st.info(
                "No revision was necessary."
            )

        # =======================================================
        # REVIEWER SCORECARD
        # =======================================================

        st.subheader(
            "Reviewer Scorecard"
        )

        score_labels = {

            "completeness":
                "Completeness",

            "citation_support":
                "Citation Support",

            "source_quality":
                "Source Quality",

            "consistency":
                "Consistency",

            "business_usefulness":
                "Business Usefulness",

            "clarity":
                "Clarity",
        }

        score_rows = []

        for key, label in score_labels.items():

            raw_score = scores.get(
                key,
                0
            )

            try:

                score = int(
                    raw_score
                )

            except (
                TypeError,
                ValueError
            ):

                score = 0

            score = max(
                0,
                min(
                    10,
                    score
                )
            )

            score_rows.append(
                {
                    "Criterion": label,
                    "Score": score,
                    "Requirement": "≥ 7",
                    "Passed": (
                        "Yes"
                        if score >= 7
                        else "No"
                    ),
                }
            )

        st.dataframe(
            score_rows,
            width="stretch"
        )

        # =======================================================
        # REVIEWER ISSUES
        # =======================================================

        st.subheader(
            "Reviewer Issues"
        )

        if issues:

            for index, issue in enumerate(
                issues,
                start=1
            ):

                if isinstance(
                    issue,
                    dict
                ):

                    category = issue.get(
                        "category",
                        "General"
                    )

                    section = issue.get(
                        "section",
                        "Overall"
                    )

                    explanation = issue.get(
                        "explanation",
                        "No explanation provided."
                    )

                    suggested_fix = issue.get(
                        "suggested_fix",
                        "No suggested fix provided."
                    )

                    with st.expander(
                        f"Issue {index}: "
                        f"{category} — {section}"
                    ):

                        st.markdown(
                            f"**Problem:** {explanation}"
                        )

                        st.markdown(
                            f"**Suggested Fix:** {suggested_fix}"
                        )

                else:

                    st.warning(
                        str(issue)
                    )

        else:

            st.write(
                "No reviewer issues were identified."
            )

        # =======================================================
        # RESEARCH GAPS
        # =======================================================

        st.subheader(
            "Research Gaps"
        )

        if research_gaps:

            for gap in research_gaps:

                st.markdown(
                    f"- {gap}"
                )

        else:

            st.write(
                "No additional research gaps were identified."
            )

        # =======================================================
        # INITIAL REVIEW
        # =======================================================

        if result.get(
            "revision_performed"
        ):

            st.subheader(
                "Initial Review"
            )

            initial_review = result.get(
                "initial_review",
                {}
            )

            initial_status = initial_review.get(
                "overall_status",
                "NEEDS_REVISION"
            )

            if initial_status == "PASS":

                st.success(
                    "Initial review: PASS"
                )

            else:

                st.warning(
                    "Initial review: NEEDS REVISION"
                )

            initial_scores = initial_review.get(
                "scores",
                {}
            )

            initial_score_rows = []

            for key, label in score_labels.items():

                raw_score = initial_scores.get(
                    key,
                    0
                )

                try:

                    score = int(
                        raw_score
                    )

                except (
                    TypeError,
                    ValueError
                ):

                    score = 0

                score = max(
                    0,
                    min(
                        10,
                        score
                    )
                )

                initial_score_rows.append(
                    {
                        "Criterion": label,
                        "Score": score,
                        "Passed": (
                            "Yes"
                            if score >= 7
                            else "No"
                        ),
                    }
                )

            st.dataframe(
                initial_score_rows,
                width="stretch"
            )

        # =======================================================
        # FINAL REPORT
        # =======================================================

        if status == "PASS":

            st.subheader(
                "Approved Final Report"
            )

            st.success(
                "This report passed the reviewer gate and "
                "is approved for final display."
            )

            st.markdown(
                result.get(
                    "final_report_markdown",
                    ""
                )
            )

        else:

            st.subheader(
                "Unapproved Draft Report"
            )

            st.warning(
                "This report is NOT approved because it did not "
                "pass the Week 6 reviewer gate. It is available "
                "below for inspection only."
            )

            with st.expander(
                "Inspect Unapproved Draft Report",
                expanded=False
            ):

                st.markdown(
                    result.get(
                        "final_report_markdown",
                        ""
                    )
                )

        # =======================================================
        # SHARED EVIDENCE
        # =======================================================

        st.subheader(
            "Shared Evidence Used"
        )

        evidence_records = result.get(
            "evidence_records",
            []
        )

        if evidence_records:

            st.dataframe(
                evidence_records,
                width="stretch"
            )

        else:

            st.warning(
                "No shared evidence records were returned."
            )

        # =======================================================
        # PIPELINE SUMMARY
        # =======================================================

        st.subheader(
            "Pipeline Summary"
        )

        summary = {

            "Research Question":
                result.get(
                    "question",
                    ""
                ),

            "Reviewer Status":
                status,

            "Revision Performed":
                (
                    "Yes"
                    if result.get(
                        "revision_performed"
                    )
                    else "No"
                ),

            "Evidence Records":
                len(
                    evidence_records
                ),

            "Report ID":
                result.get(
                    "report_id"
                ),
        }

        st.dataframe(
            [
                {
                    "Field": key,
                    "Value": value
                }

                for key, value
                in summary.items()
            ],
            width="stretch"
        )