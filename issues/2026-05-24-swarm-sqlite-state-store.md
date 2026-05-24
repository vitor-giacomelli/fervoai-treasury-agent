## Summary
Implement SQLite-backed swarm campaign/task/status persistence to support auditable execution and resumable status streaming.

## Environment
- **Product/Service**: fervoAI Treasury Agent backend persistence
- **Region/Version**: `master` as of 2026-05-24
- **Browser/OS**: N/A

## Reproduction Steps
1. Run current workflow and deploy simulation.
2. Inspect backend for swarm campaign/task state store.
3. Confirm no DB persistence exists for dispatch lifecycle.
4. Restart services and verify no deploy state/history can be recovered.

## Expected Behavior
Swarm dispatch should persist campaign metadata, task state transitions, and execution results in a local durable store.

## Actual Behavior
No swarm persistence layer currently exists.

## Error Details
```
No persistent execution ledger for swarm dispatch lifecycle.
```

## Visual Evidence
Reference:
- plan Step 2 in `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`
- blueprint section 2 in `docs/Expansion/SWARM_EXPANSION_PLAN.md`

## Impact
**High** - No audit trail, no status replay/recovery, and no deterministic post-run diagnostics.

## Additional Context
Implementation scope:
- Add `backend/swarm_store.py` with:
  - `init_db()`
  - campaign/task create/update/read helpers
  - status event append/read helpers
- Add idempotent table initialization on backend startup
- Use safe JSON serialization for result payloads

Acceptance criteria:
- Campaign and task tables are created automatically
- Dispatch writes campaign + tasks and status updates mutate persisted state
- Status stream can read persisted entries for the same `campaign_id`

Verification:
- `python -c "from swarm_store import init_db; init_db(); print('db_ok')"` (run in `backend/`)
- `python -c "import sqlite3; c=sqlite3.connect('swarm_state.db'); print(c.execute(\"select name from sqlite_master where type='table'\").fetchall())"` (run in `backend/`)

