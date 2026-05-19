# API Reference

## Base URLs

- Local backend: `http://localhost:8000`
- Docker frontend proxy path: `/api/*` (nginx -> backend)

## Health Endpoint

### `GET /health`

Returns service liveness.

Response:

```json
{
  "status": "ok"
}
```

## Root Endpoint

### `GET /`

Returns service metadata.

Response:

```json
{
  "service": "fervoAI.treasury",
  "stream_endpoint": "/api/stream_workflow?query=start"
}
```

## Stream Endpoint

### `GET /api/stream_workflow`

Primary orchestration endpoint using Server-Sent Events.

#### Query Parameters

- `query` (string, optional, default `start`)
- `demo_mode` (boolean, optional)
- `api_key` (string, optional; browser auth path)

#### Header Parameters

- `X-API-Key` (string, optional)

#### Auth Rules

- If `ENFORCE_STREAM_AUTH` is true, either `X-API-Key` or `api_key` must match `STREAM_API_KEY`.
- If `REQUIRE_STREAM_API_KEY=TRUE` but `STREAM_API_KEY` is empty, auth enforcement is disabled (availability safeguard).

#### Rate Limits

- Enforced per client identifier (IP / forwarded headers).
- Controlled by:
  - `STREAM_RATE_LIMIT_REQUESTS`
  - `STREAM_RATE_LIMIT_WINDOW_SECONDS`

#### Response Type

- `Content-Type: text/event-stream`
- Message frame:

```text
data: {"type":"...","text":"...","payload":{...}}

```

## SSE Event Contract

The backend emits JSON envelopes with this shape:

```json
{
  "type": "string",
  "text": "string | null",
  "payload": "object | null"
}
```

### `type = monologue`

Human-readable machine thoughts and stage narration.

Example:

```json
{
  "type": "monologue",
  "text": "Workflow booted. Strategic query: AI Infrastructure",
  "payload": {
    "stage": "init",
    "started_at": "2026-05-19T06:05:50.650711+00:00"
  }
}
```

### `type = vad`

Internal sentiment telemetry.

Example:

```json
{
  "type": "vad",
  "payload": {
    "valence": 0.55,
    "arousal": 0.48,
    "dominance": 0.62
  }
}
```

### `type = grant_candidate`

Candidate grant selected by filtering path.

Example (shortened):

```json
{
  "type": "grant_candidate",
  "payload": {
    "title": "Innovation for Next-Generation Testing Methodologies",
    "opportunity_number": "NSF-2024-TEST-001",
    "agency": "National Science Foundation (NSF)",
    "close_date": "2024-10-15T23:59:59Z",
    "source": "synthetic_fallback"
  }
}
```

### `type = pitch`

Final proposal package output.

Example (shortened):

```json
{
  "type": "pitch",
  "payload": {
    "pitch_draft": "To solve the acute operational backlog...",
    "model_used": "gemini-2.5-flash",
    "status": "SUCCESS",
    "feasibility_score": {
      "technical_fit": 89,
      "compliance_readiness": 82,
      "capital_efficiency": 86,
      "execution_confidence": 90,
      "composite_score": 87,
      "rationale": "Strong fit..."
    },
    "swarm_tasks": [
      {
        "assignee": "Vitor",
        "objective": "Design technical delivery plan...",
        "domain_alignment": "...",
        "expected_output": "...",
        "priority": "P1",
        "status": "queued"
      }
    ]
  }
}
```

### `type = error`

Fatal workflow failure or no-results failure.

Example:

```json
{
  "type": "error",
  "text": "No qualifying grants were found for this workflow run."
}
```

### `type = done`

Terminal event for successful or failed runs.

Success example:

```json
{
  "type": "done",
  "payload": {
    "success": true,
    "selected_grant": {
      "opportunity_number": "NSF-2024-TEST-001"
    },
    "finished_at": "2026-05-19T06:05:55.186821+00:00"
  }
}
```

Failure example:

```json
{
  "type": "done",
  "payload": {
    "success": false,
    "error_id": "abcdef123456"
  }
}
```

## Client Integration Notes

- Frontend hook is implemented in `frontend/src/hooks/useTreasuryStream.ts`.
- For browser-only auth, append `api_key` query param.
- Prefer same-origin `/api` in production/container.
- In Vite dev, ensure proxy target backend is reachable or stream will fail with `ECONNREFUSED`.
