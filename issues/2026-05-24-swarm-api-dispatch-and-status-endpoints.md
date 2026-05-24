## Summary
Add authenticated backend swarm endpoints for dispatch creation and live status SSE streaming.

## Environment
- **Product/Service**: fervoAI Treasury Agent FastAPI surface
- **Region/Version**: `master` as of 2026-05-24
- **Browser/OS**: Any HTTP client/browser

## Reproduction Steps
1. Inspect `backend/main.py` route map.
2. Confirm only `/api/stream_workflow` exists for orchestration output.
3. Attempt to call `/api/swarm/dispatch` and `/api/swarm/status/{campaign_id}`.
4. Observe no operational swarm endpoints are available.

## Expected Behavior
Backend should expose typed, authenticated endpoints for dispatch and status stream, reusing existing auth/rate-limit controls.

## Actual Behavior
No swarm dispatch/status API surface exists.

## Error Details
```
Missing backend API endpoints for real deploy execution and status telemetry.
```

## Visual Evidence
Reference:
- plan Step 5 in `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`
- current API docs in `docs/API_REFERENCE.md`

## Impact
**High** - Frontend cannot perform real deploy orchestration without API surfaces.

## Additional Context
Implementation scope:
- Add:
  - `POST /api/swarm/dispatch`
  - `GET /api/swarm/status/{campaign_id}` (SSE)
- Reuse auth and rate-limit policy:
  - `X-API-Key` / stream auth guard
  - per-client throttling
- Launch dispatcher asynchronously and return campaign ID immediately

Acceptance criteria:
- Dispatch returns stable `campaign_id` and immediate acknowledgment
- Status endpoint streams lifecycle events for matching campaign
- Unauthorized requests return `401`; excessive calls return `429`

Verification:
- `python -m compileall backend\\main.py backend\\orchestrator.py`
- `curl.exe -X POST "http://127.0.0.1:8000/api/swarm/dispatch" -H "Content-Type: application/json" -H "X-API-Key: <STREAM_API_KEY>" --data "{...}"`
- `curl.exe -N "http://127.0.0.1:8000/api/swarm/status/<campaign_id>" -H "X-API-Key: <STREAM_API_KEY>"`

