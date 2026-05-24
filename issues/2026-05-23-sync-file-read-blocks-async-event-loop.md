## Summary
Company state loading performs synchronous disk I/O in the request path, blocking the asyncio event loop.

## Environment
- **Product/Service**: fervoAI Treasury Agent (backend pitch/state pipeline)
- **Region/Version**: Repository `master` (audit dated 2026-05-23)
- **Browser/OS**: N/A

## Reproduction Steps
1. Start backend and open concurrent streaming requests.
2. Trigger workflows that call company state load.
3. Observe synchronous `read_text` execution in `_load_company_state`.
4. Monitor response latency under concurrent load.

## Expected Behavior
State file reads should be non-blocking or cached to avoid stalling the event loop.

## Actual Behavior
Synchronous file reads can block all in-flight async work on the worker loop.

## Error Details
`backend/pitch_generator.py` uses `self.state_file_path.read_text(...)` in execution path.

## Visual Evidence
Reference: `AUDIT_FINDINGS_AND_SUGGESTIONS.md` section 1.4.

## Impact
**Medium** - Latency spikes and dropped/timeout-prone streams under moderate concurrency.

## Additional Context
Suggested fix: switch to async file I/O (`anyio.Path.read_text`) and add fallback/caching strategy.
