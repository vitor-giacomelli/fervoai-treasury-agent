# fervoAI Treasury Agent

Live grant-intelligence application that discovers federal opportunities, ranks and filters them, generates a pitch package, and streams internal orchestration telemetry to a terminal-style UI.

This repository contains the complete product slice used for hackathon demo and near-term production hardening.

## What The App Does

1. Accepts a strategic business query.
2. Expands query vectors (Gemini-assisted when enabled).
3. Pulls active opportunities from Grants.gov (`forecasted|posted` scope).
4. Filters candidate grants with Gemini relevance ranking.
5. Selects a target and generates a structured pitch payload.
6. Streams thought telemetry and machine state through SSE.
7. Presents a phased HUD:
   - Hunt: cognitive telemetry
   - Lock: bento proposal dashboard
   - Deploy: swarm execution simulation + audit log

## Repository Structure

```text
fervoai-treasury-agent/
  backend/
    main.py
    orchestrator.py
    grants_gov_api.py
    pitch_generator.py
    pydantic_models.py
    fervo_state.json
    requirements.txt
  frontend/
    src/
      App.tsx
      hooks/useTreasuryStream.ts
      types/stream.ts
  scripts/
    rebuild-backend-no-cache.ps1
  docs/
    API_REFERENCE.md
    ARCHITECTURE.md
    CONFIGURATION.md
    OPERATIONS_RUNBOOK.md
    DEEP_DIVE_HACKATHON_STRATEGY_INTEGRATION.md
  docker-compose.yml
  .env.example
```

## Quick Start

### Option A: Docker Compose

```powershell
docker compose up --build
```

Endpoints:
- Frontend: `http://localhost`
- Backend health: `http://localhost:8000/health`

### Option B: Local Processes

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```

Frontend dev URL:
- `http://127.0.0.1:4173`

## Documentation Index

- [Architecture](docs/ARCHITECTURE.md)
- [API + SSE Contract](docs/API_REFERENCE.md)
- [Configuration](docs/CONFIGURATION.md)
- [Operations Runbook](docs/OPERATIONS_RUNBOOK.md)
- [User Guide](docs/USER_GUIDE.md)
- [Hackathon Strategy Integration](docs/DEEP_DIVE_HACKATHON_STRATEGY_INTEGRATION.md)

## Current Runtime Characteristics

- Transport: Server-Sent Events (`text/event-stream`)
- Backend stack: FastAPI + async orchestration + httpx + google-genai
- Frontend stack: React + TypeScript + Tailwind + EventSource
- Auth model (stream): optional API key enforcement
- Rate limiting: per-client sliding window
- Concurrency: bounded via async semaphore
- Demo reliability: deterministic fallback supported when `DEMO_MODE=TRUE`

## Development Commands

Frontend:

```powershell
cd frontend
npm run dev
npm run build
npm run lint
```

Backend:

```powershell
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

## Fast Recovery Script

If backend container gets into a bad state:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-backend-no-cache.ps1
```

This script removes the backend service container, rebuilds image with `--no-cache`, restarts it, and prints compose status.

## Security Notes

- Do not ship real secrets in repository files.
- If `REQUIRE_STREAM_API_KEY=TRUE` and `STREAM_API_KEY` is empty, auth enforcement is intentionally disabled for availability and emits warning logs.
- For exposed environments, set:
  - `REQUIRE_STREAM_API_KEY=TRUE`
  - `STREAM_API_KEY=<strong-random-secret>`
  - frontend `VITE_STREAM_API_KEY` when browser clients must authenticate.

## Licensing

- License: [MIT-LICENSE.txt](MIT-LICENSE.txt)
- Third-party provenance: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
