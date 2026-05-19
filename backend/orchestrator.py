from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator

from grants_gov_api import GrantsGovAPI
from pitch_generator import PitchGenerator

grants_api = GrantsGovAPI()
pitch_generator = PitchGenerator()
logger = logging.getLogger(__name__)


def _sse(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


async def run_treasury_workflow(query: str, demo_mode: bool) -> AsyncGenerator[str, None]:
    started_at = datetime.now(timezone.utc).isoformat()
    try:
        yield _sse(
            {
                "type": "monologue",
                "text": f"Workflow booted. Strategic query: {query}",
                "payload": {"stage": "init", "started_at": started_at},
            }
        )
        await asyncio.sleep(0.05)

        yield _sse(
            {
                "type": "monologue",
                "text": "Fetching grant opportunities from Grants.gov adapters.",
                "payload": {"stage": "fetch_grants"},
            }
        )
        grants = await grants_api.search_grants(keyword=query, limit=12, demo_mode=demo_mode)
        yield _sse(
            {
                "type": "vad",
                "payload": {"valence": 0.55, "arousal": 0.48, "dominance": 0.62},
            }
        )
        yield _sse(
            {
                "type": "monologue",
                "text": f"Acquired {len(grants)} candidate grants. Evaluating relevance with Gemini.",
                "payload": {"stage": "gemini_filter"},
            }
        )

        filtered = await pitch_generator.filter_grants_with_gemini(
            grants=grants,
            query=query,
            max_results=3,
            demo_mode=demo_mode,
        )
        for grant in filtered:
            yield _sse(
                {
                    "type": "grant_candidate",
                    "payload": grant.model_dump(),
                }
            )

        if not filtered:
            yield _sse(
                {
                    "type": "error",
                    "text": "No qualifying grants were found for this workflow run.",
                }
            )
            yield _sse({"type": "done", "payload": {"success": False}})
            return

        selected_grant = filtered[0]
        yield _sse(
            {
                "type": "monologue",
                "text": f"Selected {selected_grant.opportunity_number}. Generating pitch draft.",
                "payload": {"stage": "generate_pitch"},
            }
        )
        pitch = await pitch_generator.generate_pitch(
            startup_name="fervoAI.treasury",
            focus_area=query,
            grant=selected_grant,
            demo_mode=demo_mode,
        )
        yield _sse({"type": "pitch", "payload": pitch.model_dump()})
        yield _sse(
            {
                "type": "done",
                "payload": {
                    "success": True,
                    "selected_grant": selected_grant.model_dump(),
                    "finished_at": datetime.now(timezone.utc).isoformat(),
                },
            }
        )
    except Exception:
        error_id = uuid.uuid4().hex[:12]
        logger.exception("Treasury workflow failed. error_id=%s", error_id)
        yield _sse(
            {
                "type": "error",
                "text": f"Workflow failed unexpectedly. Reference: {error_id}",
            }
        )
        yield _sse({"type": "done", "payload": {"success": False, "error_id": error_id}})
