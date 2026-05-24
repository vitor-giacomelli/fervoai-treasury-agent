## Summary
Replace frontend timeout-based deploy simulation with real swarm dispatch calls and live status subscription rendering.

## Environment
- **Product/Service**: fervoAI Treasury Agent frontend HUD
- **Region/Version**: `master` as of 2026-05-24
- **Browser/OS**: Browser clients using React HUD

## Reproduction Steps
1. Complete a Hunt/Lock run in the UI.
2. Click `Deploy Swarm Workflow`.
3. Observe local timer-based transition and static success messaging.
4. Inspect network calls and confirm no dispatch/status API integration.

## Expected Behavior
Deploy should call backend dispatch endpoint and render task state from live backend status events.

## Actual Behavior
Deploy relies on local timeout and simulated audit messages.

## Error Details
```
UI deploy lifecycle is not bound to backend execution state.
```

## Visual Evidence
Reference:
- `frontend/src/App.tsx`
- plan Steps 6-7 in `docs/Expansion/SWARM_SUPERPOWERS_IMPLEMENTATION_PLAN.md`

## Impact
**High** - UI cannot prove or control real execution outcomes.

## Additional Context
Implementation scope:
- Add `frontend/src/hooks/useSwarmDispatch.ts`:
  - `dispatchSwarm(payload)`
  - `subscribeSwarmStatus(campaignId)`
- Update `frontend/src/App.tsx`:
  - remove timeout-only simulation path
  - bind deploy button to dispatch API
  - render status updates and failure states from SSE events
- Keep mock connector messaging for demo-safe environments

Acceptance criteria:
- Deploy action always produces a backend `campaign_id`
- UI task statuses progress from backend events, not local timer
- UI handles failed dispatch/status connection with explicit operator feedback

Verification:
- `npm run build` (run in `frontend/`)
- `npm run lint` (run in `frontend/`)
- Manual: Hunt -> Lock -> Deploy and confirm live status updates

