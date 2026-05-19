from __future__ import annotations

import json
import logging
import os
import re

import google.genai as genai

from pydantic_models import GrantOpportunity, PitchResult

logger = logging.getLogger(__name__)


class PitchGenerator:
    def __init__(self) -> None:
        gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        self.api_key = gemini_api_key or google_api_key
        self.primary_model = "gemini-2.5-flash"
        self.fallback_model = "gemini-2.5-flash-lite"
        self.enabled = bool(self.api_key)
        self.client = None
        if self.enabled:
            if gemini_api_key and google_api_key and gemini_api_key != google_api_key:
                logger.warning(
                    "Both GEMINI_API_KEY and GOOGLE_API_KEY are set with different values. "
                    "Enforcing fallback policy and using GEMINI_API_KEY."
                )
            # The google-genai SDK gives precedence to GOOGLE_API_KEY when both env vars exist.
            # We normalize it to the selected key so project fallback policy stays deterministic.
            os.environ["GOOGLE_API_KEY"] = self.api_key
            self.client = genai.Client(api_key=self.api_key)
        else:
            logger.warning("No Gemini API key found (GEMINI_API_KEY or GOOGLE_API_KEY): template mode enabled")

    async def filter_grants_with_gemini(
        self,
        grants: list[GrantOpportunity],
        query: str,
        max_results: int = 3,
        demo_mode: bool = False,
    ) -> list[GrantOpportunity]:
        if demo_mode or not self.enabled or not grants:
            return grants[:max_results]

        serialized = [
            {
                "opportunity_number": g.opportunity_number,
                "title": g.title,
                "agency": g.agency,
                "description": g.description,
                "category": g.category,
                "close_date": g.close_date,
            }
            for g in grants
        ]
        prompt = (
            "You are filtering grant opportunities for an enterprise AI treasury agent.\n"
            f"User strategic query: {query}\n"
            f"Select up to {max_results} most relevant opportunities.\n"
            "Return JSON only in this schema: {\"selected_ids\": [\"id1\", \"id2\"]}\n"
            f"Candidates:\n{json.dumps(serialized, ensure_ascii=False)}"
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.primary_model,
                contents=prompt,
            )
            selected_ids = self._extract_selected_ids(response.text)
        except Exception as err:
            logger.warning("Gemini filtering failed, using fallback ordering: %s", err)
            return grants[:max_results]

        selected = [g for g in grants if g.opportunity_number in selected_ids]
        if not selected:
            return grants[:max_results]
        return selected[:max_results]

    async def generate_pitch(
        self,
        startup_name: str,
        focus_area: str,
        grant: GrantOpportunity,
        demo_mode: bool = False,
    ) -> PitchResult:
        if demo_mode or not self.enabled:
            return self._template_pitch(startup_name, focus_area, grant, "Template (No API Key)")

        prompt = (
            "You are an expert grant writer. Write a concise enterprise-ready pitch in 150-200 words.\n"
            f"Startup ecosystem: {startup_name}\n"
            f"Focus area: {focus_area}\n"
            f"Grant: {grant.title}\n"
            f"Agency: {grant.agency}\n"
            "Narrative hierarchy requirements:\n"
            "1) The primary subject is the Treasury Agent (fervoAI.treasury).\n"
            "2) Frame the Treasury Agent as the autonomous infrastructure being proposed/deployed to solve the grant's core problem.\n"
            "3) Use action verbs tied to the Treasury Agent as the active entity doing the work.\n"
            "4) Mention FERVOAI only as the overarching ecosystem/creator, not the main actor.\n"
            "5) The opening sentence must introduce the Treasury Agent as the lead solution.\n"
            "Use Triple-Horizon framing: acute pain, technical deviation, macro lock."
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.primary_model,
                contents=prompt,
            )
            draft = self._enforce_treasury_agent_hierarchy(
                draft=(response.text or "").strip(),
                startup_name=startup_name,
                focus_area=focus_area,
            )
            return PitchResult(
                pitch_draft=draft,
                model_used=self.primary_model,
                status="SUCCESS",
            )
        except Exception:
            try:
                response = await self.client.aio.models.generate_content(
                    model=self.fallback_model,
                    contents=prompt,
                )
                draft = self._enforce_treasury_agent_hierarchy(
                    draft=(response.text or "").strip(),
                    startup_name=startup_name,
                    focus_area=focus_area,
                )
                return PitchResult(
                    pitch_draft=draft,
                    model_used=self.fallback_model,
                    status="SUCCESS",
                )
            except Exception as err:
                logger.warning("Gemini pitch generation failed, using template: %s", err)
                return self._template_pitch(startup_name, focus_area, grant, "Template (Fallback)")

    @staticmethod
    def _extract_selected_ids(raw_text: str | None) -> list[str]:
        if not raw_text:
            return []
        text = raw_text.strip()
        text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
        data = json.loads(text)
        ids = data.get("selected_ids", [])
        if isinstance(ids, list):
            return [str(item) for item in ids]
        return []

    @staticmethod
    def _template_pitch(
        startup_name: str,
        focus_area: str,
        grant: GrantOpportunity,
        model_used: str,
    ) -> PitchResult:
        return PitchResult(
            pitch_draft=(
                f"To solve the acute operational backlog, we propose deployment of the Treasury Agent "
                f"(fervoAI.treasury), an autonomous infrastructure capability built within the {startup_name} ecosystem. "
                f"The Treasury Agent addresses {grant.title} by orchestrating grant intelligence workflows focused on {focus_area}, "
                "automating prioritization, synthesis, and execution loops in mission-critical financial operations. "
                "FERVOAI remains the creator ecosystem context, while the Treasury Agent is the active entity delivering measurable outcomes."
            ),
            model_used=model_used,
            status="FALLBACK",
        )

    @staticmethod
    def _enforce_treasury_agent_hierarchy(draft: str, startup_name: str, focus_area: str) -> str:
        text = draft.strip()
        if not text:
            return text

        if "treasury agent" in text.lower():
            return text

        prefix = (
            f"To solve the core challenge, we propose the Treasury Agent (fervoAI.treasury), "
            f"an autonomous infrastructure capability within the {startup_name} ecosystem focused on {focus_area}. "
        )
        return f"{prefix}{text}"
