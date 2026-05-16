# Deep Dive Hackathon Strategy Integration

This document integrates and operationalizes the strategy described in:

- `C:\Users\vitor\Documents\Projetos\Hackaton Docs\Deep Dive Hackathon Strategy Integration.md`

The purpose here is to convert the long-form strategic narrative into an execution contract for this repository.

## 1) Strategic Thesis

Core thesis:
- Passive "tool wrappers" are not enough for high-tier hackathon evaluation.
- Winning posture is an autonomous loop with visible introspection.

Repository implication:
- `fervoai-treasury-agent` must remain an autonomous workflow system, not a static API-only app.

## 2) Competition Fit and Positioning

Target fit vectors:
- Agentic workflows.
- Enterprise utility.
- Strong sponsor alignment.
- Strong demo memorability.

Repository implication:
- Every feature should strengthen one of these vectors.
- If a change is "nice to have" but does not move these vectors, defer it.

## 3) Architecture Direction (Codified)

### 3.1 Backend as autonomous orchestrator

Required behavior:
1. Fetch grants.
2. Evaluate/filter.
3. Generate pitch.
4. Emit state continuously.

Current implementation anchor:
- `backend/orchestrator.py`

### 3.2 No-DB telemetry path

Required behavior:
- Stream backend internal state directly to frontend.
- Avoid DB dependency for telemetry transport.

Current implementation anchor:
- `backend/main.py` (`StreamingResponse`)
- `frontend/src/hooks/useTreasuryStream.ts` (`EventSource`)

### 3.3 Tactical introspection UI

Required behavior:
- Show monologue.
- Show confidence/state signals (VAD).
- Show workflow progression artifacts (grant candidates, pitch result).

Current implementation anchor:
- `frontend/src/components/hud/TacticalHUD.tsx`
- `frontend/src/components/hud/MonologueTerminal.tsx`

## 4) SSE Contract Discipline

Event shape:
- `data: <json>\n\n`

Canonical event types:
- `monologue`
- `vad`
- `grant_candidate`
- `pitch`
- `error`
- `done`

Rule:
- Do not introduce incompatible event schemas without updating both producer and consumer in the same commit slice.

## 5) Reliability-First Demo Policy

The strategy explicitly emphasizes deterministic fallback behavior for live demos.

Operational rule:
- Keep a deterministic path (`demo_mode`) healthy at all times.
- Demo reliability outranks adding new risky functionality near presentation windows.

## 6) Cognitive Engine Policy

Prompt and model policy from strategy:
- Keep prompt pipeline modular and parseable.
- Prefer structured outputs for machine parsing.
- Avoid fragile free-form responses in critical flow control.

Repository implication:
- `pitch_generator.py` must remain robust under partial model failure and keep fallback behavior.

## 7) Scope Control Rules (Anti-Creep)

When under clock pressure:
- Preserve thin-layer integration over deep rewrites.
- Keep modifications localized and reversible.
- Favor proven components from cannibalized sources.

Do not:
- Over-engineer infra.
- Introduce non-essential dependencies.
- Expand beyond treasury-agent repo unless absolutely blocked.

## 8) Presentation and Demo Script Guidance

Narrative loop to preserve:
1. Tell: problem and cost of manual process.
2. Show: autonomous run + visible thinking.
3. Tell: enterprise value + sponsor alignment.

Repository implication:
- Maintain one-click demo flow.
- Keep UI narrative cues clear for non-technical judges.

## 9) Sponsor and Infra Notes

The original strategy references specific sponsor tracks and infra posture.
For this repo, the practical rule is:
- Keep backend deployable as a single straightforward service.
- Keep frontend static/dev-host friendly.
- Keep infra assumptions explicit in README and deployment notes.

## 10) Living Checklist for This Repo

Before each major push:
- [ ] Does this change strengthen agent autonomy?
- [ ] Does this change improve or preserve introspection visibility?
- [ ] Does this change preserve deterministic demo fallback?
- [ ] Does this change keep scope disciplined?
- [ ] Are docs updated to reflect new behavior?

## 11) Source Attribution

This integrated document is based on the user-provided strategy file:
- `C:\Users\vitor\Documents\Projetos\Hackaton Docs\Deep Dive Hackathon Strategy Integration.md`

It is intentionally adapted into concise operational guidance for this repository.

