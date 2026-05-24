## Summary
Implement backend swarm dispatcher service that executes campaign tasks against dynamic node/channel mappings with resilient fallback behavior.

## Environment
- **Product/Service**: fervoAI Treasury Agent backend orchestration
- **Region/Version**: `master` as of 2026-05-24
- **Browser/OS**: N/A

## Reproduction Steps
1. Generate a workflow with `swarm_tasks`.
2. Attempt to execute those tasks in backend runtime.
3. Confirm there is no `execute_swarm_campaign(...)` service path.
4. Confirm missing-assignee or missing-channel handling is undefined.

## Expected Behavior
Dispatcher should execute tasks per node configuration, persist status transitions, and continue processing even when individual tasks fail.

## Actual Behavior
No operational dispatcher exists; deploy behavior remains UI simulation.

## Error Details
```
Missing backend execution engine for swarm task lifecycle.
```

## Visual Evidence
Reference:
- plan Step 4 in `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`
- architecture intent in `docs/Expansion/SWARM_EXPANSION_PLAN.md`

## Impact
**High** - Without dispatcher orchestration, dispatch endpoints cannot deliver real operational value.

## Additional Context
Implementation scope:
- Add `backend/swarm_dispatcher.py`
- Implement:
  - `execute_swarm_campaign(campaign_id, tasks, company_state, mode)`
  - per-task status updates (`queued -> in_progress -> completed|failed`)
  - dynamic channel resolution by assignee
  - fallback routing for missing assignee/channel config

Acceptance criteria:
- Dispatcher processes all tasks in a campaign without global abort on single-task failure
- Status transitions are persisted and streamable
- Missing assignee/channel emits structured warning + fallback outcome

Verification:
- `python -m compileall backend\\swarm_dispatcher.py`
- `python -c "from swarm_dispatcher import execute_swarm_campaign; print('dispatcher_import_ok')"` (run in `backend/`)

