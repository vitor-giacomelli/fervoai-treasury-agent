### Goal
Implement real swarm execution (backend dispatch + status streaming + frontend live deploy state) by replacing the current UI-only deploy simulation with operational, auditable workflows.

### Assumptions
- We keep the current `GET /api/stream_workflow` pipeline unchanged for Hunt/Lock.
- Swarm execution is introduced as a separate phase via new backend endpoints (`/api/swarm/*`).
- First production slice uses SQLite-backed campaign/task state (local, deterministic, no new external infra dependency).
- Connectors run in two modes: `mock` (default for demos) and `live` (env-enabled for Jira/Slack/Email).
- Existing `STREAM_API_KEY` auth model is reused for new swarm endpoints in this phase.

### Plan
1. Define dispatch and execution contracts
   - Files: `backend/pydantic_models.py`, `docs/API_REFERENCE.md`
   - Change:
     - Add typed models for `SwarmDispatchPayload`, `SwarmDispatchResponse`, `SwarmStatusEvent`.
     - Extend `SwarmNode` with optional `channels: dict[str, str]` for dynamic routing.
   - Verify:
     - `python -m compileall backend\\pydantic_models.py`
     - `rg -n "SwarmDispatchPayload|SwarmStatusEvent|channels" backend\\pydantic_models.py docs\\API_REFERENCE.md`

2. Add swarm persistence layer (campaign + task state)
   - Files: `backend/swarm_store.py` (new), `backend/requirements.txt`
   - Change:
     - Implement SQLite initialization and CRUD helpers for campaigns/tasks/status logs.
     - Add idempotent `init_db()` call path and safe serialization for result payloads.
   - Verify:
     - `python -c "from swarm_store import init_db; init_db(); print('db_ok')"` (run in `backend/`)
     - `python -c "import sqlite3; c=sqlite3.connect('swarm_state.db'); print(c.execute(\"select name from sqlite_master where type='table'\").fetchall())"` (run in `backend/`)

3. Implement connector interface and adapters
   - Files: `backend/connectors/__init__.py` (new), `backend/connectors/jira.py` (new), `backend/connectors/slack.py` (new), `backend/connectors/email.py` (new), `backend/connectors/agent.py` (new)
   - Change:
     - Create unified async connector functions returning normalized result envelopes.
     - Support `mock` execution mode for demo-safe behavior and deterministic tests.
   - Verify:
     - `python -m compileall backend\\connectors`
     - `python -c "from connectors import jira, slack, email, agent; print('connectors_ok')"` (run in `backend/`)

4. Build swarm dispatcher service
   - Files: `backend/swarm_dispatcher.py` (new), `backend/pitch_generator.py`
   - Change:
     - Implement `execute_swarm_campaign(campaign_id, tasks, company_state, mode)` with dynamic node/channel routing.
     - Add non-fatal fallback path when assignee is missing or channel config is incomplete.
   - Verify:
     - `python -m compileall backend\\swarm_dispatcher.py`
     - `python -c "from swarm_dispatcher import execute_swarm_campaign; print('dispatcher_import_ok')"` (run in `backend/`)

5. Expose backend swarm API endpoints
   - Files: `backend/main.py`, `backend/orchestrator.py`
   - Change:
     - Add `POST /api/swarm/dispatch` to persist campaign/tasks and launch async execution.
     - Add `GET /api/swarm/status/{campaign_id}` SSE endpoint for live execution events.
     - Reuse existing auth and rate-limit guards for swarm routes.
   - Verify:
     - `python -m compileall backend\\main.py backend\\orchestrator.py`
     - `curl.exe -X POST "http://127.0.0.1:8000/api/swarm/dispatch" -H "Content-Type: application/json" -H "X-API-Key: <STREAM_API_KEY>" --data "{...}"`
     - `curl.exe -N "http://127.0.0.1:8000/api/swarm/status/<campaign_id>" -H "X-API-Key: <STREAM_API_KEY>"`

6. Add frontend swarm dispatch client + status stream hook
   - Files: `frontend/src/hooks/useSwarmDispatch.ts` (new), `frontend/src/types/stream.ts`, `frontend/src/hooks/useTreasuryStream.ts`
   - Change:
     - Add `dispatchSwarm()` and `subscribeSwarmStatus()` primitives.
     - Keep stream-workflow hook focused on Hunt/Lock while deploy behavior migrates to swarm-specific hook.
   - Verify:
     - `npm run build` (run in `frontend/`)
     - `npm run lint` (run in `frontend/`)

7. Replace UI-only deploy timeout with real execution lifecycle
   - Files: `frontend/src/App.tsx`
   - Change:
     - Remove `setTimeout`-only dispatch simulation path.
     - Bind deploy button to `POST /api/swarm/dispatch` and render live task status from SSE updates.
     - Keep `DEMO_MODE` fallback messaging when connectors run in mock mode.
   - Verify:
     - `npm run build` (run in `frontend/`)
     - Manual check: run a workflow, click deploy, confirm statuses progress via backend events (not local timer)

8. Add backend tests for swarm contracts and endpoints
   - Files: `backend/tests/test_swarm_store.py` (new), `backend/tests/test_swarm_dispatch_api.py` (new), `backend/tests/test_swarm_status_stream.py` (new), `backend/requirements-dev.txt` (new)
   - Change:
     - Add tests for DB persistence, dispatch response shape, and status event streaming contract.
     - Add regression coverage for malformed assignee/channel routing fallback.
   - Verify:
     - `python -m pytest backend/tests -q`

9. Document operational usage and migration from simulation
   - Files: `docs/ARCHITECTURE.md`, `docs/API_REFERENCE.md`, `docs/USER_GUIDE.md`, `docs/OPERATIONS_RUNBOOK.md`, `docs/CONFIGURATION.md`
   - Change:
     - Replace “deploy simulation” wording with “real dispatch + optional mock connector mode”.
     - Document new env vars (connector mode, webhook/token keys) and runbook checks.
   - Verify:
     - `rg -n "simulate deploy|simulation" docs`
     - `rg -n "/api/swarm/dispatch|/api/swarm/status" docs`

10. Final integration validation and release checklist
   - Files: `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`, `README.md`
   - Change:
     - Record final smoke sequence and expected outcomes for demo-day usage.
     - Add release checklist for auth, health, dispatch, status stream, and rollback toggle.
   - Verify:
     - `curl.exe http://127.0.0.1:8000/health`
     - `curl.exe -N "http://127.0.0.1:8000/api/stream_workflow?query=test&demo_mode=true" -H "X-API-Key: <STREAM_API_KEY>"`
     - End-to-end manual: Hunt -> Lock -> Deploy -> status feed completion

### Risks & mitigations
- Risk: Connector failures block task completion.
  - Mitigation: Per-task isolation, retries with bounded backoff, persist failure state without aborting campaign.
- Risk: Swarm status SSE disconnects under proxy/runtime variance.
  - Mitigation: Heartbeat events, reconnect token (`campaign_id`), and resumable state reads from DB.
- Risk: Dynamic channel payload introduces invalid config at runtime.
  - Mitigation: Strict Pydantic validation + startup env checks + clear 4xx validation responses.
- Risk: Demo regressions during transition from simulated deploy.
  - Mitigation: Keep explicit `mock` connector mode and feature flag until live connectors are validated.

### Rollback plan
- Keep the current UI simulation path behind `SWARM_EXECUTION_MODE=simulate` until rollout sign-off.
- If swarm endpoints regress:
  - Revert `backend/main.py`, `backend/swarm_dispatcher.py`, and `frontend/src/App.tsx` to prior commit.
  - Disable swarm endpoints via env toggle and continue using Hunt/Lock only.
- Preserve schema compatibility by making new fields additive (`channels`, dispatch payloads), avoiding breaking existing stream consumers.
