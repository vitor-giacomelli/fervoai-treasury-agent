## Summary
Current IP rate limiting is process-local in-memory state, vulnerable to bypass in multi-worker/multi-replica deployments and unbounded key growth.

## Environment
- **Product/Service**: fervoAI Treasury Agent (backend API gateway)
- **Region/Version**: Repository `master` (audit dated 2026-05-23)
- **Browser/OS**: N/A

## Reproduction Steps
1. Start backend with multiple workers/replicas.
2. Send high-rate requests from same client through different workers.
3. Observe independent per-process rate-limit state.
4. Send many unique client IPs and monitor dictionary growth over time.

## Expected Behavior
Rate limiting should be centralized/shared across instances with bounded memory and key expiration.

## Actual Behavior
Limiter state is local and volatile (`defaultdict(deque)`), enabling bypass and memory pressure.

## Error Details
`backend/main.py` keeps limiter state in process memory under async lock only.

## Visual Evidence
Reference: `AUDIT_FINDINGS_AND_SUGGESTIONS.md` section 1.6.

## Impact
**High** - Weak abuse protection in production scale-out and potential memory exhaustion under distributed traffic.

## Additional Context
Suggested fix: move limiter state to Redis (sorted-set/window pattern) with TTL and consistent thresholds.
