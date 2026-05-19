# User Guide

## Intended Audience

- Hackathon judges
- Product operators
- Team members running grant workflows

## Primary Workflow

1. Enter strategic context in `Strategic Context`.
2. Click `Run Treasury Agent`.
3. Observe live `Cognitive Telemetry` (Hunt phase).
4. Wait for lock transition into proposal dashboard.
5. Review:
   - target grant
   - feasibility matrix
   - swarm task assignment
6. Use:
   - `Copy Proposal`
   - `Send by Email`
7. Click `Deploy Swarm Workflow` to trigger execution simulation and audit log.

## Interface Phases

### Phase 1: Hunt

Only telemetry panel is shown while stream is active (`connecting` or `connected`).

Purpose:
- prove live orchestration
- focus attention on machine reasoning

### Phase 2: Lock

When stream completes:
- telemetry unmounts
- bento dashboard mounts with target + pitch + swarm state

### Phase 3: Deploy

Deploy button simulates dispatch latency and updates task status:
- `Queued -> Dispatched`
- audit log appears
- signature completion line confirms handoff boundary

## Output Interpretation

### Feasibility Matrix

Scores are 0-100:
- Technical Fit
- Compliance Readiness
- Capital Efficiency
- Execution Confidence
- Composite Score

### Swarm Protocol

Each task card shows:
- assignee
- status
- compact objective

Assignees are validated against `backend/fervo_state.json`.

## Tips For Live Demos

- Use concise, specific strategic queries.
- Keep `DEMO_MODE=TRUE` when external APIs are unstable.
- Confirm backend health before presenting.
- Run one warmup query before recording.
