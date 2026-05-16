from __future__ import annotations

import asyncio
import logging
from datetime import datetime

import httpx

from pydantic_models import GrantOpportunity

logger = logging.getLogger(__name__)


class GrantsGovAPI:
    BASE_URL = "https://apply07.grants.gov/grantsws/rest/opportunities/search/"

    MOCK_GRANTS: list[dict[str, str]] = [
        {
            "title": "AI-Driven Clean Energy Optimization SBIR",
            "opportunity_number": "DE-FOA-0003001",
            "agency": "Department of Energy",
            "description": "Funding for AI startups developing grid optimization and renewable energy integration technologies.",
            "award_ceiling": "$275,000",
            "award_floor": "$150,000",
            "close_date": "December 15, 2026",
            "post_date": "September 1, 2026",
            "url": "https://www.energy.gov/eere/funding",
            "category": "Energy",
            "source": "mock_fallback",
        },
        {
            "title": "Next-Gen Climate Tech Accelerator",
            "opportunity_number": "NSF-24-501",
            "agency": "National Science Foundation",
            "description": "Accelerating breakthrough climate technologies for high-impact solutions.",
            "award_ceiling": "$1,000,000",
            "award_floor": "$250,000",
            "close_date": "January 30, 2027",
            "post_date": "October 15, 2026",
            "url": "https://new.nsf.gov/funding/opportunities",
            "category": "Science and Technology",
            "source": "mock_fallback",
        },
    ]

    def __init__(self) -> None:
        self.headers = {
            "User-Agent": "fervoAI.treasury/1.0",
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        self.timeout = 15
        self.max_retries = 3

    async def search_grants(
        self,
        keyword: str,
        limit: int = 20,
        demo_mode: bool = False,
    ) -> list[GrantOpportunity]:
        if demo_mode:
            return [GrantOpportunity(**item) for item in self.MOCK_GRANTS[:limit]]

        hits = await self._search_by_keyword(keyword=keyword, limit=limit)
        if not hits:
            logger.warning("No live grants found, using mock fallback")
            hits = self.MOCK_GRANTS[:limit]

        normalized: list[GrantOpportunity] = []
        for hit in hits:
            try:
                normalized.append(GrantOpportunity(**hit))
            except Exception:
                continue

        if not normalized:
            normalized = [GrantOpportunity(**item) for item in self.MOCK_GRANTS[:limit]]
        return normalized

    async def _search_by_keyword(self, keyword: str, limit: int) -> list[dict[str, str]]:
        async with httpx.AsyncClient(
            headers=self.headers,
            timeout=self.timeout,
            follow_redirects=True,
        ) as client:
            for attempt in range(self.max_retries):
                try:
                    response = await client.post(
                        self.BASE_URL,
                        json={
                            "keyword": keyword,
                            "sortBy": "closeDate",
                            "sortOrder": "ASC",
                            "rows": limit,
                            "startRecordNum": 0,
                        },
                    )
                    if response.status_code in (429, 500, 502, 503, 504):
                        if attempt < self.max_retries - 1:
                            await asyncio.sleep(2**attempt)
                            continue
                    response.raise_for_status()
                    payload = response.json()
                    return self._format_grants(payload.get("oppHits", []))
                except Exception as err:
                    logger.warning("Grants.gov request failed on attempt %s: %s", attempt + 1, err)
                    if attempt < self.max_retries - 1:
                        await asyncio.sleep(2**attempt)
                        continue
        return []

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
