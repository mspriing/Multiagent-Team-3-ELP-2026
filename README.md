# Multiagent-Team-3-ELP-2026 

## Week 3: parallel specialist research

`team2_week3_student.py` is the supplied Team 2 Week 3 starter, completed with independent Competitor, Market, and Tech/Regulatory research. The Supervisor assigns the work, Tavily searches each objective, DeepSeek writes each specialist brief, and the three specialists run concurrently.

### Run locally

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements_team2.txt
cp .env.example .env
```

Enter your own `TAVILY_API_KEY` and `DEEPSEEK_API_KEY` values in `.env`, then run:

```bash
streamlit run team2_week3_student.py
```

Never commit `.env` or share API keys. The `.gitignore` excludes `.env` and virtual environments. API calls may use account credits. Week 3 does not include a synthesis agent or shared evidence store.

## Week 4 branch: shared evidence store

`team2_week4.py` extends the Week 3 graph with source-by-source evidence extraction and a local SQLite store. It is work in progress on the `week4-evidence-store` branch. The database is ignored by Git. To reuse a `.env` stored outside this checkout, set `ELP_ENV_FILE` to its local path when starting Streamlit; otherwise, put your own `.env` beside the app. Do not commit the key file or database.

Run fixture checks without API calls:

```bash
python -m unittest discover -s tests -v
```

## Week 5 branch: draft synthesis report

`team2_week4.py` now also runs Supervisor → Specialists → Shared Evidence →
Synthesis when **Run Full Synthesis Pipeline** is clicked. It writes a ten-section
draft report to the `reports` table in the same `team2_evidence.db` file as the
Week 4 `evidence` table. The first nine sections come from DeepSeek using only
the current run's numbered evidence; Python builds Sources / References from
the evidence URLs. The Week 3 and Week 4 buttons remain available.

Start Streamlit with the same API key configuration described above. A live run
uses Tavily and DeepSeek credits. The fixture suite checks the full graph and
both SQLite tables without calling external services.

## Weeks 6–7: reviewed synthesis and bounded research loop

`team2_week4.py` includes the Week 6 reviewer and the Week 7 gap/conflict
check in the same combined Streamlit app. Start it with your existing API key
configuration and click **Run Week 7 Research Loop**. The graph researches an
actionable gap or conflict at most once, merges the new evidence with the
original evidence, then synthesizes and reviews the report. The final report
appears only when the reviewer passes it; otherwise the draft stays in an
unapproved expander. The Week 3–6 buttons remain available.

Run the fixture suite without external API calls:

```bash
python -m unittest discover -s tests -q
```

A live run uses Tavily and DeepSeek credits. The automated checks use fixture
responses and do not establish the factual accuracy of a live report.
