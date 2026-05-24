## Summary
Implement the full swarm execution program to replace frontend-only deploy simulation with real backend dispatch, live status streaming, connector routing, and operational guardrails.

## Environment
- **Product/Service**: fervoAI Treasury Agent (backend + frontend)
- **Region/Version**: `master` plan baseline as of 2026-05-24
- **Browser/OS**: Any browser (deploy behavior is currently client-simulated)

## Reproduction Steps
1. Run a normal Hunt/Lock workflow from the dashboard.
2. Click `Deploy Swarm Workflow`.
3. Observe completion after local timeout and static success logs.
4. Verify no backend dispatch endpoint, campaign persistence, or execution status stream is used.

## Expected Behavior
Deploy should create a backend campaign, route tasks through real connectors (or controlled mock mode), and stream task-level execution status to the UI until completion.

## Actual Behavior
Deploy is simulated in the frontend with timeout-based state change and static audit messages.

## Error Details
```
Gap is architectural: no operational swarm dispatch pipeline is currently wired end-to-end.
```

## Visual Evidence
Reference:
- `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`
- `docs/Expansion/SWARM_EXPANSION_PLAN.md`
- `frontend/src/App.tsx` deploy simulation flow

## Impact
**High** - Product presents execution UX without real orchestration effects, limiting production readiness and auditability.

## Additional Context
Execution program scope:
- Backend contracts, state store, connectors, dispatcher, endpoints
- Frontend dispatch + status subscription
- Test baseline and docs migration from simulation to real execution

Success criteria:
- End-to-end flow: Hunt -> Lock -> Deploy (real backend campaign) -> live status stream -> terminal completion state
- Controlled rollback path via execution mode toggle

