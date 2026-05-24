## Summary
Grants lookup uses an unofficial browser endpoint with spoofed headers and aggressive nested parallel requests that can trigger blocking/throttling.

## Environment
- **Product/Service**: fervoAI Treasury Agent (grants discovery adapter)
- **Region/Version**: Repository `master` (audit dated 2026-05-23)
- **Browser/OS**: N/A

## Reproduction Steps
1. Execute grant search through backend adapter.
2. Observe requests targeting `https://api.grants.gov/v1/api/search2` with browser-like headers.
3. For returned opportunities, observe parallel contact email sub-requests via `asyncio.gather`.
4. Repeat under moderate traffic.

## Expected Behavior
Integration should use official Grants.gov developer feeds/APIs with explicit rate controls and bounded concurrency.

## Actual Behavior
Unofficial endpoint access plus bursty parallelism creates fragile dependency and block-risk behavior.

## Error Details
`backend/grants_gov_api.py` uses browser spoof headers and unbounded per-result enrichment fan-out.

## Visual Evidence
Reference: `AUDIT_FINDINGS_AND_SUGGESTIONS.md` section 1.3.

## Impact
**High** - Frequent lookup failures and potential IP throttling/CAPTCHA can force synthetic fallbacks and degrade live data quality.

## Additional Context
Suggested fix: migrate to official feeds and gate enrichment with semaphore throttling + jitter.
