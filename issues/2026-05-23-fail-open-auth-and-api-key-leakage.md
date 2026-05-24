## Summary
Backend stream authentication fails open when API key env vars are misconfigured, and frontend sends API keys in URL query parameters.

## Environment
- **Product/Service**: fervoAI Treasury Agent (backend + frontend streaming flow)
- **Region/Version**: Repository `master` (audit dated 2026-05-23)
- **Browser/OS**: Any (query-string leakage risk is infrastructure-wide)

## Reproduction Steps
1. Set `REQUIRE_STREAM_API_KEY=true` without defining `STREAM_API_KEY`.
2. Start backend service.
3. Observe backend warning and auth disable behavior.
4. Open frontend stream flow and inspect generated stream URL.
5. Confirm API key is appended in `?api_key=...` query params.

## Expected Behavior
Service should fail closed on startup when auth is required but key is missing, and clients should transmit credentials via secure headers.

## Actual Behavior
Auth can be disabled due to configuration drift, and API key is exposed in request URLs.

## Error Details
Fail-open branch in `backend/main.py` and query-based token transport in `frontend/src/hooks/useTreasuryStream.ts`.

## Visual Evidence
Reference: `AUDIT_FINDINGS_AND_SUGGESTIONS.md` section 1.1.

## Impact
**Critical** - Can expose protected streaming/LLM endpoints, leak keys through logs/history/proxies, and create unbounded cost/security risk.

## Additional Context
Suggested fix: fail-closed startup guard plus `X-API-Key` header validation using constant-time comparison.
