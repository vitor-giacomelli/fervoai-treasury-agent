## Summary
Create connector abstraction and adapters for Jira, Slack, Email, and autonomous agent execution with `mock` and `live` modes.

## Environment
- **Product/Service**: fervoAI Treasury Agent connector layer
- **Region/Version**: `master` as of 2026-05-24
- **Browser/OS**: N/A

## Reproduction Steps
1. Inspect backend modules for connector abstractions.
2. Confirm deploy flow has no reusable connector interface.
3. Attempt to route a generated task to Jira/Slack/Email based on assignee metadata.
4. Confirm no operational integration path exists.

## Expected Behavior
Dispatcher should call a normalized connector interface that supports deterministic mock mode and configurable live mode for external delivery.

## Actual Behavior
No connector interface/adapters are implemented for swarm dispatch.

## Error Details
```
Missing integration adapter layer for channel-specific swarm routing.
```

## Visual Evidence
Reference:
- plan Step 3 in `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`
- dynamic connector architecture in `docs/Expansion/SWARM_EXPANSION_PLAN.md`

## Impact
**High** - Swarm cannot execute real side effects or demo-safe deterministic behavior in a controlled contract.

## Additional Context
Implementation scope:
- Add:
  - `backend/connectors/__init__.py`
  - `backend/connectors/jira.py`
  - `backend/connectors/slack.py`
  - `backend/connectors/email.py`
  - `backend/connectors/agent.py`
- Standardize return envelope:
  - `status`, `external_id`, `message`, `raw_response`
- Add env-driven mode selection (`mock` default)

Acceptance criteria:
- All connectors import and execute in mock mode
- Live mode validates required credentials per connector
- Connector failures return structured error outcomes without crashing process

Verification:
- `python -m compileall backend\\connectors`
- `python -c "from connectors import jira, slack, email, agent; print('connectors_ok')"` (run in `backend/`)

