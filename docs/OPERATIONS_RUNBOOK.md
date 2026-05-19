# Operations Runbook

## Purpose

This runbook covers day-to-day operational actions for local, demo, and server execution.

## Startup Procedures

### Full stack with Docker

```powershell
docker compose up --build
```

Expected:
- Backend on `:8000`
- Frontend on `:80`

Health check:

```powershell
curl.exe http://127.0.0.1:8000/health
```

### Split local startup

Backend:

```powershell
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Frontend:

```powershell
cd frontend
npm run dev
```

## Fast Recovery

If backend container is stale/hung:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-backend-no-cache.ps1
```

What it does:
1. Remove backend service container.
2. Build backend image with no cache.
3. Start backend service detached.
4. Print backend status.

## Common Failures

### 1) Vite proxy `ECONNREFUSED` on `/api/stream_workflow`

Symptom:
- Browser/Vite logs show proxy error and connection refused.

Root cause:
- Backend is not listening on target (`localhost:8000` by default).

Fix:
1. Verify backend health endpoint.
2. Start/restart backend.
3. Confirm `frontend/vite.config.ts` target or `VITE_API_TARGET`.

### 2) UI stuck in `connecting`

Possible causes:
- Backend unreachable.
- Stream auth mismatch (`STREAM_API_KEY` vs `VITE_STREAM_API_KEY`).
- Proxy target mismatch.

Fix checklist:
1. `curl /health` returns 200.
2. Stream endpoint responds manually:
   `curl.exe -N "http://127.0.0.1:8000/api/stream_workflow?query=test&demo_mode=true"`.
3. Confirm frontend env values.
4. Keep `VITE_API_BASE_URL` empty when using same-origin/proxy mode.

### 3) `401 Unauthorized workflow access`

Cause:
- Enforced stream auth but wrong/missing key.

Fix:
- Set matching `STREAM_API_KEY` (backend) and `VITE_STREAM_API_KEY` (frontend browser path), or provide `X-API-Key` from custom client.

### 4) `429 Rate limit exceeded`

Cause:
- Per-client request volume over configured limit.

Fix:
- Increase `STREAM_RATE_LIMIT_REQUESTS`, window, or slow client retries.

## Deployment Notes

- `docker-compose.yml` defaults `DEMO_MODE` to `TRUE` for resilient live demos.
- Override with root `.env` when live API behavior is required.
- Frontend container uses nginx proxy `/api -> backend:8000` with buffering disabled for SSE.

## Verification Checklist Before Demo

1. `GET /health` is healthy.
2. Stream opens and emits `monologue` quickly.
3. UI transitions through:
   - Hunt terminal
   - Lock bento
   - Deploy simulation
4. Audit log appears after deploy action.
5. `Copy Proposal` and `Send by Email` actions are functioning.
