from __future__ import annotations

import json
import logging
import os
import re
from pathlib import Path

import google.genai as genai
from pydantic import ValidationError

from pydantic_models import CompanyState, FeasibilityScore, GrantOpportunity, PitchResult, SwarmTask

logger = logging.getLogger(__name__)


class PitchGenerator:
    def __init__(self) -> None:
        gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        self.api_key = gemini_api_key or google_api_key
        self.primary_model = "gemini-2.5-flash"
        self.fallback_model = "gemini-2.5-flash-lite"
        self.state_file_path = Path(__file__).resolve().parent / "fervo_state.json"
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
        company_state = self._load_company_state()
        if demo_mode or not self.enabled:
            return self._template_pitch(startup_name, focus_area, grant, company_state, "Template (No API Key)")

        prompt = self._build_pitch_prompt(
            startup_name=startup_name,
            focus_area=focus_area,
            grant=grant,
            company_state=company_state,
        )

        try:
            response = await self.client.aio.models.generate_content(
                model=self.primary_model,
                contents=prompt,
            )
            result = self._parse_v2_pitch_result(
                raw_text=(response.text or ""),
                startup_name=startup_name,
                focus_area=focus_area,
                company_state=company_state,
            )
            result.model_used = self.primary_model
            result.status = "SUCCESS"
            return result
        except Exception:
            try:
                response = await self.client.aio.models.generate_content(
                    model=self.fallback_model,
                    contents=prompt,
                )
                result = self._parse_v2_pitch_result(
                    raw_text=(response.text or ""),
                    startup_name=startup_name,
                    focus_area=focus_area,
                    company_state=company_state,
                )
                result.model_used = self.fallback_model
                result.status = "SUCCESS"
                return result
            except Exception as err:
                logger.warning("Gemini pitch generation failed, using template: %s", err)
                return self._template_pitch(startup_name, focus_area, grant, company_state, "Template (Fallback)")

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
        company_state: CompanyState,
        model_used: str,
    ) -> PitchResult:
        swarm_tasks = PitchGenerator._build_default_swarm_tasks(company_state, focus_area, grant)
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
            feasibility_score=FeasibilityScore(
                technical_fit=89,
                compliance_readiness=82,
                capital_efficiency=86,
                execution_confidence=90,
                composite_score=87,
                rationale=(
                    "Strong fit for autonomous execution with balanced compliance load and capital-efficiency upside."
                ),
            ),
            swarm_tasks=swarm_tasks,
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

    def _load_company_state(self) -> CompanyState:
        try:
            raw_text = self.state_file_path.read_text(encoding="utf-8")
            payload = json.loads(raw_text)
            return CompanyState(**payload)
        except (OSError, json.JSONDecodeError, ValidationError) as err:
            logger.warning("Failed to load company state from %s: %s", self.state_file_path, err)
            return self._default_company_state()

    @staticmethod
    def _default_company_state() -> CompanyState:
        return CompanyState(
            ecosystem="fervoAI.*",
            core_infrastructure="Stateful agent runtimes and automated AI pipelines.",
            runway_preference="High-impact, agile capital.",
            swarm_nodes=[
                {"name": "Vitor", "role": "Tech Lead", "domain": "Core architecture and runtime implementation."},
                {"name": "Alexa", "role": "COO & Product Strategist", "domain": "Compliance and strategic operations."},
                {"name": "Treasury Agent", "role": "Autonomous Executor", "domain": "Pipeline execution and automation."},
            ],
        )

    @staticmethod
    def _build_pitch_prompt(
        startup_name: str,
        focus_area: str,
        grant: GrantOpportunity,
        company_state: CompanyState,
    ) -> str:
        state_blob = json.dumps(company_state.model_dump(), ensure_ascii=False, indent=2)
        return (
            "You are an expert grant writer and systems orchestrator.\n"
            "Write a concise enterprise-ready pitch in 150-200 words and return ONLY valid raw JSON.\n"
            f"Startup ecosystem: {startup_name}\n"
            f"Focus area: {focus_area}\n"
            f"Grant: {grant.title}\n"
            f"Agency: {grant.agency}\n"
            "Narrative hierarchy requirements:\n"
            "1) The primary subject is the Treasury Agent (fervoAI.treasury).\n"
            "2) Frame the Treasury Agent as the autonomous infrastructure being proposed/deployed.\n"
            "3) Mention FERVOAI only as the ecosystem, never as the active executor.\n"
            "4) Opening sentence must introduce the Treasury Agent as the lead solution.\n"
            "COMPANY STATE:\n"
            f"{state_blob}\n"
            "Use swarm_nodes from COMPANY STATE to assign tasks.\n"
            "Each task assignee MUST match one of swarm_nodes[].name exactly.\n"
            "Return JSON with this exact schema:\n"
            "{"
            '"pitch_draft":"string",'
            '"feasibility_score":{"technical_fit":0-100,"compliance_readiness":0-100,"capital_efficiency":0-100,'
            '"execution_confidence":0-100,"composite_score":0-100,"rationale":"string"},'
            '"swarm_tasks":[{"assignee":"string","objective":"string","domain_alignment":"string",'
            '"expected_output":"string","priority":"P1|P2|P3","status":"queued|in_progress|blocked|done"}]'
            "}"
        )

    def _parse_v2_pitch_result(
        self,
        raw_text: str,
        startup_name: str,
        focus_area: str,
        company_state: CompanyState,
    ) -> PitchResult:
        payload = self._extract_json_object(raw_text)
        pitch_draft = self._enforce_treasury_agent_hierarchy(
            draft=str(payload.get("pitch_draft") or "").strip(),
            startup_name=startup_name,
            focus_area=focus_area,
        )

        feasibility_payload = payload.get("feasibility_score")
        swarm_payload = payload.get("swarm_tasks")

        if not isinstance(feasibility_payload, dict):
            raise ValueError("Missing feasibility_score payload")
        if not isinstance(swarm_payload, list):
            raise ValueError("Missing swarm_tasks payload")

        valid_assignees = {node.name for node in company_state.swarm_nodes}
        swarm_tasks: list[SwarmTask] = []
        for item in swarm_payload:
            if not isinstance(item, dict):
                continue
            task = SwarmTask(**item)
            if task.assignee not in valid_assignees:
                raise ValueError(f"Invalid assignee in swarm task: {task.assignee}")
            swarm_tasks.append(task)

        if not swarm_tasks:
            raise ValueError("No valid swarm tasks returned")

        return PitchResult(
            pitch_draft=pitch_draft,
            model_used="",
            status="SUCCESS",
            feasibility_score=FeasibilityScore(**feasibility_payload),
            swarm_tasks=swarm_tasks,
        )

    @staticmethod
    def _extract_json_object(raw_text: str) -> dict:
        text = raw_text.strip()
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()
        obj_start = text.find("{")
        obj_end = text.rfind("}")
        if obj_start == -1 or obj_end == -1 or obj_end <= obj_start:
            raise ValueError("No JSON object found in model response")
        candidate = text[obj_start : obj_end + 1]
        parsed = json.loads(candidate)
        if not isinstance(parsed, dict):
            raise ValueError("Model payload is not a JSON object")
        return parsed

    @staticmethod
    def _build_default_swarm_tasks(
        company_state: CompanyState,
        focus_area: str,
        grant: GrantOpportunity,
    ) -> list[SwarmTask]:
        nodes = {node.name: node for node in company_state.swarm_nodes}

        vitor_domain = nodes.get("Vitor").domain if "Vitor" in nodes else "Core architecture."
        alexa_domain = nodes.get("Alexa").domain if "Alexa" in nodes else "Compliance and operations."
        treasury_domain = nodes.get("Treasury Agent").domain if "Treasury Agent" in nodes else "Execution automation."

        return [
            SwarmTask(
                assignee="Vitor" if "Vitor" in nodes else next(iter(nodes.keys()), "Treasury Agent"),
                objective=f"Design technical delivery plan for {focus_area} aligned to {grant.opportunity_number}.",
                domain_alignment=vitor_domain,
                expected_output="Implementation blueprint and risk controls.",
                priority="P1",
                status="queued",
            ),
            SwarmTask(
                assignee="Alexa" if "Alexa" in nodes else next(iter(nodes.keys()), "Treasury Agent"),
                objective=f"Validate compliance narrative and budget strategy for {grant.agency}.",
                domain_alignment=alexa_domain,
                expected_output="Compliance matrix and funding narrative alignment.",
                priority="P1",
                status="queued",
            ),
            SwarmTask(
                assignee="Treasury Agent" if "Treasury Agent" in nodes else next(iter(nodes.keys()), "Treasury Agent"),
                objective=f"Execute data extraction and orchestration cycle for {focus_area}.",
                domain_alignment=treasury_domain,
                expected_output="Operational task ledger and automated submission artifacts.",
                priority="P1",
                status="queued",
            ),
        ]
