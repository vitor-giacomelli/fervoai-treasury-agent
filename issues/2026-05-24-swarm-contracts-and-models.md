## Summary
Add swarm dispatch/status contracts and dynamic channel-aware node models to support typed backend orchestration.

## Environment
- **Product/Service**: fervoAI Treasury Agent backend contracts
- **Region/Version**: `master` as of 2026-05-24
- **Browser/OS**: N/A

## Reproduction Steps
1. Inspect `backend/pydantic_models.py`.
2. Confirm `SwarmNode` has no `channels` mapping.
3. Confirm there is no `SwarmDispatchPayload`, `SwarmDispatchResponse`, or `SwarmStatusEvent`.
4. Inspect API docs and confirm no typed swarm dispatch/status contract coverage.

## Expected Behavior
Typed models should define dispatch payloads, dispatch responses, and status event envelopes, and `SwarmNode` should support dynamic integration channels.

## Actual Behavior
Current models cover stream/pitch artifacts only and do not expose formal swarm execution contracts.

## Error Details
```
Missing contract models for operational swarm execution path.
```

## Visual Evidence
Reference:
- `backend/pydantic_models.py`
- `docs/API_REFERENCE.md`
- plan Step 1 in `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`

## Impact
**High** - Without formal contracts, dispatch and status endpoints are brittle and hard to validate/test.

## Additional Context
Implementation scope:
- Extend `SwarmNode` with `channels: dict[str, str] = Field(default_factory=dict)`
- Add:
  - `SwarmDispatchPayload`
  - `SwarmDispatchResponse`
  - `SwarmStatusEvent`
- Update API docs for request/response and SSE status schema

Acceptance criteria:
- New models compile and validate representative payloads
- API docs include examples for dispatch and status stream events
- Model changes are additive and backward-compatible for existing stream consumers

Verification:
- `python -m compileall backend\\pydantic_models.py`
- `rg -n "SwarmDispatchPayload|SwarmDispatchResponse|SwarmStatusEvent|channels" backend\\pydantic_models.py docs\\API_REFERENCE.md`

