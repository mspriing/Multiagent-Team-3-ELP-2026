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
