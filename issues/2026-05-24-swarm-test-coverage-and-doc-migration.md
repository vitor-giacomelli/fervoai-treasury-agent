## Summary
Add swarm execution test baseline and migrate docs from simulation narrative to real dispatch architecture with mock-mode guidance.

## Environment
- **Product/Service**: fervoAI Treasury Agent QA + docs
- **Region/Version**: `master` as of 2026-05-24
- **Browser/OS**: N/A

## Reproduction Steps
1. Inspect backend for swarm-specific automated tests.
2. Inspect docs for deploy behavior wording.
3. Confirm docs still describe deploy as simulation.
4. Confirm no automated regression suite exists for swarm dispatch/status contracts.

## Expected Behavior
Repository should include swarm contract/endpoint tests and docs that reflect real dispatch execution with explicit mock/live operating modes.

## Actual Behavior
Swarm test baseline is missing and docs still center simulation semantics.

## Error Details
```
Documentation and test coverage do not represent operational swarm execution state.
```

## Visual Evidence
Reference:
- plan Steps 8-10 in `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`
- current docs:
  - `docs/ARCHITECTURE.md`
  - `docs/API_REFERENCE.md`
  - `docs/USER_GUIDE.md`
  - `docs/OPERATIONS_RUNBOOK.md`
  - `docs/CONFIGURATION.md`

## Impact
**High** - No reliable regression guardrails and high risk of drift between implementation and operator guidance.

## Additional Context
Implementation scope:
- Add tests:
  - `backend/tests/test_swarm_store.py`
  - `backend/tests/test_swarm_dispatch_api.py`
  - `backend/tests/test_swarm_status_stream.py`
- Add/update dev test requirements
- Update docs to:
  - describe real dispatch lifecycle
  - document `/api/swarm/dispatch` and `/api/swarm/status/{campaign_id}`
  - include env/config guidance for connector mock/live mode
  - include release checklist and rollback toggle

Acceptance criteria:
- CI/local tests cover dispatch contract, persistence, and status stream behavior
- All deploy documentation references real execution flow and mock-mode fallback accurately
- Runbook includes troubleshooting for dispatch/status failures

Verification:
- `python -m pytest backend/tests -q`
- `rg -n "simulate deploy|simulation" docs`
- `rg -n "/api/swarm/dispatch|/api/swarm/status" docs`

