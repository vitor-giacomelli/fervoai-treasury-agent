# fervoAI.treasury

Autonomous enterprise agent for grant discovery and pitch generation, with real-time introspection streamed from Python to a cyber-brutalist React HUD.

## Why This Project Exists

Most AI demos stop at "input -> output". This project is built to show the full autonomous loop:

1. Discover opportunities.
2. Evaluate relevance.
3. Generate actionable proposal output.
4. Stream internal reasoning and confidence signals live to the UI.

The goal is not only utility, but also transparency of agent behavior under time pressure.

## Scope Guardrails

In scope:
- Treasury-agent monorepo only (`backend` + `frontend` in this repo).
- FastAPI + SSE + React HUD flow.
- Database-free telemetry pipeline for speed and reliability.

Out of scope (for now):
- Expanding or modifying source repos beyond cannibalization needs.
- Complex infra/orchestration beyond what is needed for the demo.
- Feature creep that does not improve reliability, clarity, or demo impact.

## Monorepo Layout

```text
fervoai-treasury-agent/
  backend/
    main.py
    orchestrator.py
    grants_gov_api.py
    pitch_generator.py
    pydantic_models.py
    requirements.txt
  frontend/
    src/
      components/hud/
      hooks/useTreasuryStream.ts
  docker-compose.yml
  MIT-LICENSE.txt
  THIRD_PARTY_NOTICES.md
  docs/
```

## Runtime Architecture

### Backend
- `main.py`: FastAPI app and `GET /api/stream_workflow`.
- `orchestrator.py`: autonomous async generator that emits stream events.
- `grants_gov_api.py`: Grants.gov fetch adapter + retry + mock fallback.
- `pitch_generator.py`: Gemini filtering + pitch generation (template fallback).

### Frontend
- `useTreasuryStream.ts`: native `EventSource` client.
- `TacticalHUD.tsx`: tactical dashboard shell.
- `MonologueTerminal.tsx`: live internal monologue feed.

### Transport Contract
- Protocol: Server-Sent Events (`text/event-stream`).
- Message shape: `data: <json>\n\n`.
- Core event types currently emitted:
  - `monologue`
  - `vad`
  - `grant_candidate`
  - `pitch`
  - `error`
  - `done`

## Environment Variables

Backend key resolution order:
1. `GEMINI_API_KEY`
2. `GOOGLE_API_KEY` (fallback)

If neither key is present, the backend switches to template fallback behavior.
If both are set, this project enforces `GEMINI_API_KEY` as the selected key.

Create:
- `backend/.env`
- `frontend/.env` (optional)

Example:

```env
GEMINI_API_KEY=your_key_here
# GOOGLE_API_KEY=optional_fallback_key
```

Frontend API base URL (optional):

```env
VITE_API_BASE_URL=http://localhost:8000
```

Default behavior when `VITE_API_BASE_URL` is unset:
- Vite dev server on `localhost:4173` (or `localhost:5173` if reconfigured): uses `http://localhost:8000`
- Containerized/Nginx runtime: uses same-origin `/api` proxy

## Local Development

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open:
- `http://localhost:4173`

## Docker Compose

```powershell
docker compose up --build
```

Services:
- Backend: `http://localhost:8000`
- Frontend: `http://localhost`

### Dev vs Stage `DEMO_MODE`

Base `docker-compose.yml` defaults to:
- `DEMO_MODE=TRUE`

Local override:
- create a root `.env` file with:

```env
DEMO_MODE=FALSE
GEMINI_API_KEY=your_key_here
```

This keeps Vultr deployment bulletproof by default, while allowing live API testing on your laptop.

## Demo Mode

`/api/stream_workflow` supports:
- `query` (string)
- `demo_mode` (bool)

Example:
- `http://localhost:8000/api/stream_workflow?query=start&demo_mode=true`

`demo_mode=true` is the deterministic fallback for stable demos when external APIs are flaky.

## Hackathon Strategy Integration

The deep strategy blueprint provided for Milan AI Week is integrated in:

- [docs/DEEP_DIVE_HACKATHON_STRATEGY_INTEGRATION.md](docs/DEEP_DIVE_HACKATHON_STRATEGY_INTEGRATION.md)

This file is our execution north star for:
- judging psychology,
- architecture choices,
- demo narrative discipline,
- infrastructure reliability posture.

## Compliance

- Project license: [MIT-LICENSE.txt](MIT-LICENSE.txt)
- Provenance and reuse notices: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
