# Configuration

## Environment Variables Overview

Configuration is split across backend runtime and frontend build/runtime environment.

## Backend Variables

| Variable | Required | Default | Description |
|---|---|---:|---|
| `DEMO_MODE` | No | `FALSE` (local) / `TRUE` (compose default) | Forces deterministic fallback run mode. |
| `GEMINI_API_KEY` | Recommended | empty | Primary Gemini key. |
| `GOOGLE_API_KEY` | Optional | empty | Secondary key fallback when Gemini key missing. |
| `REQUIRE_STREAM_API_KEY` | No | `TRUE` | Enables stream API key enforcement policy. |
| `STREAM_API_KEY` | Required for auth | empty | Shared secret for `/api/stream_workflow`. |
| `STREAM_RATE_LIMIT_REQUESTS` | No | `8` | Max requests per rate-limit window per client. |
| `STREAM_RATE_LIMIT_WINDOW_SECONDS` | No | `60` | Window size in seconds. |
| `MAX_CONCURRENT_STREAMS` | No | `12` | Concurrency cap for active stream workflows. |

## Frontend Variables

| Variable | Required | Default | Description |
|---|---|---:|---|
| `VITE_API_BASE_URL` | No | empty | Direct absolute backend URL (when set). |
| `VITE_API_TARGET` | Dev/preview only | `http://localhost:8000` | Vite proxy target for `/api`. |
| `VITE_STREAM_API_KEY` | Optional | empty | Browser-side stream auth key appended as `api_key`. |

## Key Resolution Rules

### Gemini keys

Order used by backend components:
1. `GEMINI_API_KEY`
2. `GOOGLE_API_KEY`

If both are set and different, code warns and uses `GEMINI_API_KEY`.

### Stream auth

- `ENFORCE_STREAM_AUTH = REQUIRE_STREAM_API_KEY and bool(STREAM_API_KEY)`
- If `REQUIRE_STREAM_API_KEY=TRUE` but `STREAM_API_KEY` is empty, auth is disabled and warning is emitted.

## Recommended Config Profiles

### Local dev with live models

```env
DEMO_MODE=FALSE
GEMINI_API_KEY=your_key
REQUIRE_STREAM_API_KEY=TRUE
STREAM_API_KEY=your_strong_secret
STREAM_RATE_LIMIT_REQUESTS=8
STREAM_RATE_LIMIT_WINDOW_SECONDS=60
MAX_CONCURRENT_STREAMS=12
```

Frontend (`frontend/.env`):

```env
VITE_API_BASE_URL=
VITE_API_TARGET=http://localhost:8000
VITE_STREAM_API_KEY=your_strong_secret
```

### Demo-safe fallback profile

```env
DEMO_MODE=TRUE
REQUIRE_STREAM_API_KEY=TRUE
STREAM_API_KEY=your_strong_secret
```

## Runtime Files

- `backend/fervo_state.json` is part of runtime behavior and injected into pitch generation.
- Update this file carefully because it directly controls swarm assignment constraints.
