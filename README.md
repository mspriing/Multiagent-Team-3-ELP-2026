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
