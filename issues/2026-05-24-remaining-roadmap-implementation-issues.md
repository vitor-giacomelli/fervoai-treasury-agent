# Remaining Audit Items: Implementation Issue Drafts

## Context
The initial risk-focused issues (`#1` to `#7`) already capture the critical weak points from section 1 of the audit.
This document covers the **remaining actionable items** from section 2 ("Targeted Improvement Roadmap") as implementation-ready issue drafts for a follow-up creation pass.

## Working assumptions
- Existing issues `#1` to `#7` stay open as problem statements.
- The items below are execution tickets that can be linked to those existing issues.
- Scope is repository `master` as of 2026-05-24.

## Proposed sequencing (recommended)
1. Security foundations first (`A`, `B`)
2. Data reliability and performance (`C`, `D`, `E`)
3. Product realism and rollout safety (`F`, `G`)

---

## A) Enforce Fail-Closed Stream Auth and Header-Based API Key Transport
**Related audit items:** 2.1  
**Links to existing issue(s):** #1

### Draft issue title
Implement fail-closed stream auth with `X-API-Key` header and remove query-string key transport

### Scope
- Backend startup guard: crash fast when `REQUIRE_STREAM_API_KEY=true` and key is missing.
- Header-based auth (`X-API-Key`) with constant-time comparison.
- Frontend stream hook sends key via header-compatible transport strategy (no URL leakage).
- Remove/disable query param key usage.

### Acceptance criteria
- Server does not boot in fail-open state when key is required but absent.
- No auth token appears in stream URL, logs, browser history, or proxy query logs.
- Unauthorized requests return `401` consistently.
- Docs/config examples updated.

### Out of scope
- Full OAuth/JWT migration.

---

## B) Migrate Pitch Generation to Gemini Structured Outputs
**Related audit items:** 2.2  
**Links to existing issue(s):** #2

### Draft issue title
Adopt Gemini structured outputs for `PitchResult` and remove regex/manual JSON extraction path

### Scope
- Use `response_schema` with `application/json`.
- Replace manual fence stripping and brittle parse logic.
- Keep deterministic fallback path when model call fails.
- Normalize assignee validation (`case/spacing`) before hard failure.

### Acceptance criteria
- Structured responses validate directly into Pydantic models.
- Parsing failures from markdown wrappers are eliminated in normal runs.
- Minor assignee casing drift no longer drops entire pitch output.
- Telemetry distinguishes model failure vs validation fallback.

### Out of scope
- Prompt redesign beyond schema reliability.

---

## C) Remove Event-Loop Blocking from Company State Loading
**Related audit items:** 2.3  
**Links to existing issue(s):** #6

### Draft issue title
Convert company state file loading to non-blocking async I/O with safe fallback

### Scope
- Replace synchronous `read_text` path with async file read.
- Add resilient fallback on file read/parse/validation failure.
- Optional: short-lived in-memory cache to reduce repeated disk reads.

### Acceptance criteria
- No synchronous disk read in active async request path.
- Concurrent streaming latency does not spike due to state-file access.
- Corrupted/missing state file returns controlled fallback behavior.

### Out of scope
- Moving state to database storage.

---

## D) Replace Unofficial Grants Endpoint Strategy and Add Bounded Enrichment Concurrency
**Related audit items:** 2.4  
**Links to existing issue(s):** #3

### Draft issue title
Migrate Grants.gov adapter toward official feeds and enforce throttled contact enrichment

### Scope
- Introduce official data-source path (XML extract or approved developer endpoint).
- Add semaphore/jitter controls for contact enrichment fan-out.
- Preserve synthetic fallback for demo continuity when upstream is degraded.

### Acceptance criteria
- Adapter no longer depends solely on browser-session endpoint behavior.
- Per-request enrichment concurrency is bounded and configurable.
- Upstream throttling/errors do not collapse full request response.

### Out of scope
- Historical grant warehouse/backfill.

---

## E) Implement Redis-Backed Distributed Rate Limiter
**Related audit items:** 2.5  
**Links to existing issue(s):** #7

### Draft issue title
Introduce Redis sliding-window rate limiting for multi-worker and multi-replica consistency

### Scope
- Add Redis-backed request window tracking with TTL.
- Keep local-memory fallback only for explicit dev mode.
- Expose configuration for limits/window and failure behavior.

### Acceptance criteria
- Rate limiting is consistent across workers/replicas.
- Key growth is bounded by TTL/cleanup policy.
- 429 behavior remains deterministic under distributed load.

### Out of scope
- Full WAF replacement.

---

## F) Bridge Swarm UI to Real Backend Dispatch Integrations
**Related audit items:** 2.6  
**Links to existing issue(s):** #5

### Draft issue title
Add `/api/swarm/dispatch` backend workflow and replace UI-only timeout simulation with real execution status

### Scope
- New backend dispatch endpoint with typed request/response contracts.
- Service adapter layer for Jira/Slack (feature-flagged, environment-driven).
- Frontend deploy state bound to backend dispatch lifecycle.

### Acceptance criteria
- Deploy action performs a real backend call and returns auditable results.
- UI shows integration outcome per task (success/failure/retryable).
- Simulation mode remains available behind explicit demo flag.

### Out of scope
- Full workflow engine/orchestration platform.

---

## G) Establish Minimal Automated Test Baseline for Critical Paths
**Related audit items:** 1.7 and roadmap dependencies  
**Links to existing issue(s):** #4

### Draft issue title
Create baseline test suite for stream auth, pitch schema, grants adapter, and rate limiter behavior

### Scope
- Add unit tests for auth guardrails and schema validation paths.
- Add integration tests for stream endpoint happy/error flows.
- Add adapter tests for grants fallback and throttling behavior.

### Acceptance criteria
- CI blocks merges on test failure.
- Each remediation issue (`A` to `F`) gets at least one regression test.
- Test docs describe local run command and required env.

### Out of scope
- Full performance test harness in this phase.

---

## Suggested GitHub Labels
- `security`
- `backend`
- `frontend`
- `architecture`
- `reliability`
- `tech-debt`
- `tests`

## Suggested milestone
- `audit-remediation-wave-1`

