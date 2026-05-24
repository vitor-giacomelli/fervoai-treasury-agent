## Summary
Pitch generation depends on fragile manual JSON cleanup and strict assignee validation that rejects minor model output variation.

## Environment
- **Product/Service**: fervoAI Treasury Agent (Gemini pitch generation pipeline)
- **Region/Version**: Repository `master` (audit dated 2026-05-23)
- **Browser/OS**: N/A

## Reproduction Steps
1. Trigger pitch generation with a complex prompt.
2. Let model return JSON wrapped with markdown fencing or minor format variance.
3. Observe regex/manual cleanup and parse fallback behavior.
4. Return a `swarm_tasks.assignee` with small casing/typo drift (for example `vitor` vs `Vitor`).
5. Observe strict validator raising and template fallback.

## Expected Behavior
LLM output should be schema-enforced at generation time and tolerate low-risk formatting/assignee variation with controlled normalization.

## Actual Behavior
Manual text sanitization and strict matching create brittle failures that discard valid strategic content.

## Error Details
`backend/pitch_generator.py` relies on regex cleanup and exact assignee matching against `fervo_state.json`.

## Visual Evidence
Reference: `AUDIT_FINDINGS_AND_SUGGESTIONS.md` section 1.2.

## Impact
**High** - Causes inconsistent AI output quality, avoidable fallbacks, and reduced trust in generated strategy artifacts.

## Additional Context
Suggested fix: move to Gemini structured outputs (`response_schema`) and add robust assignee normalization/validation.
