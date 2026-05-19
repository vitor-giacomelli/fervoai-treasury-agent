from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import re
from datetime import datetime

import google.genai as genai
import httpx

from pydantic_models import GrantOpportunity

logger = logging.getLogger(__name__)


class GrantsGovAPI:
    BASE_URL = "https://api.grants.gov/v1/api/search2"
    RETRYABLE_STATUS_CODES = {429, 500, 502, 503, 504}

    def __init__(self) -> None:
        self.headers = {
            "User-Agent": "fervoAI.treasury/1.0",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        self.timeout = 15
        self.max_retries = 3

        gemini_api_key = os.getenv("GEMINI_API_KEY", "").strip()
        google_api_key = os.getenv("GOOGLE_API_KEY", "").strip()
        self.api_key = gemini_api_key or google_api_key
        self.synthetic_model = "gemini-2.5-flash-lite"
        self.synthetic_enabled = bool(self.api_key)
        self.client = None

        if self.synthetic_enabled:
            if gemini_api_key and google_api_key and gemini_api_key != google_api_key:
                logger.warning(
                    "Both GEMINI_API_KEY and GOOGLE_API_KEY are set with different values. "
                    "Enforcing fallback policy and using GEMINI_API_KEY."
                )
            os.environ["GOOGLE_API_KEY"] = self.api_key
            self.client = genai.Client(api_key=self.api_key)
        else:
            logger.warning("No Gemini API key found for synthetic fallback generation.")

    async def search_grants(
        self,
        keyword: str,
        limit: int = 20,
        demo_mode: bool = False,
    ) -> list[GrantOpportunity]:
        if demo_mode:
            synthetic = await self._generate_synthetic_fallback(keyword=keyword, limit=limit)
            return [GrantOpportunity(**item) for item in synthetic]

        hits = await self._search_by_keyword(keyword=keyword, limit=limit)
        if not hits:
            logger.warning("No live grants found, generating synthetic fallback via Gemini")
            hits = await self._generate_synthetic_fallback(keyword=keyword, limit=limit)

        normalized: list[GrantOpportunity] = []
        for hit in hits:
            try:
                normalized.append(GrantOpportunity(**hit))
            except Exception:
                continue

        if not normalized:
            synthetic = await self._generate_synthetic_fallback(keyword=keyword, limit=limit)
            normalized = [GrantOpportunity(**item) for item in synthetic]
        return normalized

    async def _search_by_keyword(self, keyword: str, limit: int) -> list[dict[str, str]]:
        async with httpx.AsyncClient(
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True,
        ) as client:
            request_body = {
                "keyword": keyword,
                "rows": limit,
                "oppStatuses": "forecasted|posted",
            }
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        self.BASE_URL,
                        json=request_body,
                    )
                    if response.status_code in self.RETRYABLE_STATUS_CODES:
                        if attempt < self.max_retries - 1:
                            delay = self._compute_backoff_delay(
                                attempt=attempt,
                                retry_after=response.headers.get("Retry-After"),
                            )
                            logger.warning(
                                "Grants.gov returned %s on attempt %s. Retrying in %.2fs.",
                                response.status_code,
                                attempt + 1,
                                delay,
                            )
                            await asyncio.sleep(delay)
                            continue
                    if response.status_code == 403:
                        logger.warning(
                            "Grants.gov returned 403 Forbidden for search2. "
                            "Treating as non-retryable; verify endpoint policy and network egress rules."
                        )
                        return []
                    if response.status_code >= 400:
                        logger.warning(
                            "Grants.gov returned non-retryable status %s for search2.",
                            response.status_code,
                        )
                        return []
                    payload = response.json()
                    opp_hits = self._extract_opp_hits(payload)
                    legacy_hits = [self._map_search2_hit(hit) for hit in opp_hits]
                    return self._format_grants(legacy_hits)
                except httpx.RequestError as err:
                    logger.warning("Grants.gov network error on attempt %s: %s", attempt + 1, err)
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self._compute_backoff_delay(attempt=attempt))
                        continue
                except (json.JSONDecodeError, ValueError) as err:
                    logger.warning("Grants.gov request failed on attempt %s: %s", attempt + 1, err)
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(self._compute_backoff_delay(attempt=attempt))
                        continue
        return []

    @staticmethod
    def _compute_backoff_delay(attempt: int, retry_after: str | None = None) -> float:
        if retry_after:
            try:
                retry_after_delay = float(retry_after)
                if retry_after_delay > 0:
                    return min(retry_after_delay, 30.0)
            except ValueError:
                pass
        base_delay = min(2**attempt, 16)
        jitter = random.uniform(0.15, 0.9)
        return base_delay + jitter

    @staticmethod
    def _extract_opp_hits(payload: dict) -> list[dict]:
        data = payload.get("data")
        if isinstance(data, dict):
            hits = data.get("oppHits")
            if isinstance(hits, list):
                return [hit for hit in hits if isinstance(hit, dict)]
        direct_hits = payload.get("oppHits")
        if isinstance(direct_hits, list):
            return [hit for hit in direct_hits if isinstance(hit, dict)]

        error_code = payload.get("errorcode")
        message = payload.get("msg")
        error_msgs = None
        if isinstance(data, dict):
            error_msgs = data.get("errorMsgs")

        logger.warning(
            "Grants.gov search2 response missing oppHits. errorcode=%s msg=%s errorMsgs=%s top_keys=%s",
            error_code,
            message,
            error_msgs,
            list(payload.keys()),
        )
        return []

    @staticmethod
    def _map_search2_hit(hit: dict) -> dict:
        agency = hit.get("agencyName") or hit.get("agencyCode") or "Unknown Agency"
        title = hit.get("title") or hit.get("opportunityTitle") or "Unknown Title"
        opportunity_number = hit.get("number") or hit.get("opportunityNumber") or ""
        opp_status = hit.get("oppStatus") or "posted"
        doc_type = hit.get("docType") or "synopsis"

        return {
            "opportunityTitle": title,
            "opportunityNumber": opportunity_number,
            "ownerFullName": agency,
            "description": f"Status: {opp_status}. Document type: {doc_type}.",
            "awardCeiling": hit.get("awardCeiling"),
            "awardFloor": hit.get("awardFloor"),
            "closeDate": hit.get("closeDate"),
            "postDate": hit.get("openDate") or hit.get("postDate"),
            "categoryOfFundingActivity": hit.get("fundingCategories", "Other"),
        }

    async def _generate_synthetic_fallback(self, keyword: str, limit: int) -> list[dict[str, str]]:
        if self.synthetic_enabled and self.client is not None:
            prompt = (
                "Generate a highly realistic, synthetic federal grant opportunity JSON "
                f"that perfectly aligns with this startup context: '{keyword}'. "
                "Return ONLY raw JSON matching this schema: title, opportunity_number "
                "(e.g., DARPA-123), agency, description, award_ceiling, award_floor, "
                "close_date, post_date, url, category, source ('synthetic_fallback'). "
                "Do not use markdown blocks."
            )
            try:
                response = self.client.models.generate_content(
                    model=self.synthetic_model,
                    contents=prompt,
                )
                parsed = self._extract_json_payload(response.text or "")
                normalized = self._normalize_synthetic_payload(parsed, keyword=keyword, limit=limit)
                if normalized:
                    return normalized
            except Exception as err:
                logger.warning("Gemini synthetic fallback failed; using local dynamic fallback: %s", err)

        return [self._local_dynamic_fallback(keyword, index=0)]

    @staticmethod
    def _extract_json_payload(raw_text: str) -> object:
        text = raw_text.strip()
        text = re.sub(r"^```(?:json)?", "", text, flags=re.IGNORECASE).strip()
        text = re.sub(r"```$", "", text).strip()

        obj_start = text.find("{")
        arr_start = text.find("[")

        if obj_start == -1 and arr_start == -1:
            raise ValueError("No JSON object found in Gemini response")

        if arr_start != -1 and (obj_start == -1 or arr_start < obj_start):
            candidate = text[arr_start : text.rfind("]") + 1]
        else:
            candidate = text[obj_start : text.rfind("}") + 1]

        return json.loads(candidate)

    def _normalize_synthetic_payload(self, payload: object, keyword: str, limit: int) -> list[dict[str, str]]:
        records: list[dict[str, str]] = []

        if isinstance(payload, dict):
            payload_items: list[object] = [payload]
        elif isinstance(payload, list):
            payload_items = payload
        else:
            payload_items = []

        for index, item in enumerate(payload_items):
            if not isinstance(item, dict):
                continue
            records.append(
                {
                    "title": str(item.get("title") or f"Strategic AI Infrastructure Initiative for {keyword}"),
                    "opportunity_number": str(item.get("opportunity_number") or self._build_opportunity_number(keyword, index)),
                    "agency": str(item.get("agency") or "National Science Foundation"),
                    "description": str(
                        item.get("description")
                        or f"Federal funding program focused on {keyword} with enterprise-grade AI outcomes."
                    ),
                    "award_ceiling": str(item.get("award_ceiling") or "$1,200,000"),
                    "award_floor": str(item.get("award_floor") or "$250,000"),
                    "close_date": str(item.get("close_date") or "December 31, 2026"),
                    "post_date": str(item.get("post_date") or "May 01, 2026"),
                    "url": str(item.get("url") or "https://www.grants.gov/search-grants"),
                    "category": str(item.get("category") or "Science and Technology"),
                    "source": "synthetic_fallback",
                }
            )
            if len(records) >= limit:
                break

        if not records:
            records.append(self._local_dynamic_fallback(keyword, index=0))

        return records

    def _local_dynamic_fallback(self, keyword: str, index: int) -> dict[str, str]:
        token = re.sub(r"[^A-Za-z0-9]", "", keyword.upper())[:5] or "AI"
        return {
            "title": f"Autonomous Systems Modernization for {keyword}",
            "opportunity_number": self._build_opportunity_number(keyword, index),
            "agency": "Defense Advanced Research Projects Agency",
            "description": (
                "Synthetic fallback generated when live grant sources are unavailable. "
                f"This opportunity aligns with {keyword} and enterprise-scale AI deployment."
            ),
            "award_ceiling": "$1,500,000",
            "award_floor": "$300,000",
            "close_date": "December 31, 2026",
            "post_date": "May 01, 2026",
            "url": "https://www.grants.gov/search-grants",
            "category": f"AI Infrastructure ({token})",
            "source": "synthetic_fallback",
        }

    @staticmethod
    def _build_opportunity_number(keyword: str, index: int) -> str:
        cleaned = re.sub(r"[^A-Za-z0-9]", "", keyword.upper())[:4] or "AI"
        return f"DARPA-{cleaned}-{100 + index}"

    def _format_grants(self, raw_grants: list[dict]) -> list[dict[str, str]]:
        formatted: list[dict[str, str]] = []
        for grant in raw_grants:
            description = grant.get("description", "")
            if len(description) > 500:
                description = f"{description[:500]}..."

            formatted.append(
                {
                    "title": grant.get("opportunityTitle", "Unknown Title"),
                    "opportunity_number": grant.get("opportunityNumber", ""),
                    "agency": grant.get("ownerFullName", "Unknown Agency"),
                    "description": description,
                    "award_ceiling": self._format_amount(grant.get("awardCeiling")),
                    "award_floor": self._format_amount(grant.get("awardFloor")),
                    "close_date": self._format_date(grant.get("closeDate")),
                    "post_date": self._format_date(grant.get("postDate")),
                    "url": f"https://www.grants.gov/search-grants?oppNum={grant.get('opportunityNumber', '')}",
                    "category": grant.get("categoryOfFundingActivity", "Other"),
                    "source": "grants_gov",
                }
            )
        return sorted(formatted, key=lambda item: self._parse_date(item.get("close_date", "")))

    @staticmethod
    def _format_amount(amount: object) -> str:
        if not amount:
            return "Not specified"
        try:
            value = float(amount)
            if value >= 1_000_000:
                return f"${value / 1_000_000:.1f}M"
            if value >= 1_000:
                return f"${value / 1_000:.0f}K"
            return f"${value:.0f}"
        except Exception:
            return str(amount)

    @staticmethod
    def _format_date(date_str: object) -> str:
        if not date_str:
            return "Not specified"
        text = str(date_str)
        for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
            try:
                return datetime.strptime(text, fmt).strftime("%B %d, %Y")
            except ValueError:
                continue
        return text

    @staticmethod
    def _parse_date(date_str: str) -> datetime:
        for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y", "%B %d, %Y"):
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return datetime.max
