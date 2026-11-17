# Multi-Agent AI Research Assistant

A full-stack AI application that uses multiple specialized agents to research, analyze, and respond to user questions.

## Workflow

```text
User
 ↓
React Frontend
 ↓
FastAPI Backend
 ↓
LangGraph
 ↓
Supervisor
 ↓
Researcher → Analyst → Writer
 ↓
Final Response
```

## Tech Stack

- **Frontend:** React, TypeScript, Vite
- **Backend:** Python, FastAPI
- **AI:** DeepSeek API
- **Agent Framework:** LangGraph

## Agents

- **Supervisor:** Routes requests to the appropriate agent
- **Researcher:** Gathers and organizes relevant information
- **Analyst:** Analyzes research and identifies key conclusions
- **Writer:** Produces the final user-friendly response

## Current Features

- DeepSeek-powered AI agents
- Multi-agent LangGraph workflow
- Supervisor routing
- Shared state between agents
- React ↔ FastAPI communication

## Next Steps

- Add Tavily web search
- Add conversation memory
- Improve error handling
- Improve frontend response formatting
- Add testing and deployment

## Run it locally

You need Python 3.10 or newer (`python3 --version`; on a Mac, `brew install python@3.12` if yours is older) and Node 20 or newer.

1. Copy `.env.example` to `.env` in the repo root and fill in `DEEPSEEK_API_KEY` and `TAVILY_API_KEY`. `.env` is ignored by Git.
2. Backend, from the repo root:

   ```bash
   python3 -m venv .venv
   .venv/bin/pip install -r backend/requirements.txt
   cd backend && ../.venv/bin/uvicorn main:app --port 8000
   ```

3. Frontend, in a second terminal:

   ```bash
   cd frontend && npm install && npm run dev
   ```

4. Open http://localhost:5173. A new question takes about a minute: the Researcher runs three web searches before the Analyst and Writer answer. Conversations are saved in `backend/conversations.db`.

## Sign-in and daily limits

People sign in with their @psu.edu email. Until `SMTP_USER` and `SMTP_PASSWORD` are set, the address alone signs you in (anyone can type an address that isn't theirs). Once they are set, the backend emails a 6-digit code that works for 10 minutes, so only the inbox's owner gets in. Each person sees only their own conversations. Each person can ask 10 questions a day and the whole app 100, reset at midnight Eastern.

## Host it on Vercel

The app runs as two Vercel projects from this repository.

1. **Backend** (Root Directory `backend`). Vercel detects FastAPI from `main.py`; `backend/vercel.json` gives each research request up to 300 seconds. Add a Neon Postgres database from the project's Storage tab, which sets `DATABASE_URL`, so saved conversations persist. Then set `DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, and `ALLOWED_ORIGINS` (the frontend's address, such as `https://your-site.vercel.app`). For sign-in, set `SMTP_USER` and `SMTP_PASSWORD` (the email account that sends the codes; for Gmail, an app password). Optional: `DAILY_LIMIT_PER_PERSON` (default 10) and `DAILY_LIMIT_TOTAL` (default 100).
2. **Frontend** (Root Directory `frontend`). Set `VITE_API_URL` to the backend's address, then deploy.

Without `DATABASE_URL`, the backend keeps using the local SQLite file, so running it on your own computer works the same as before.
