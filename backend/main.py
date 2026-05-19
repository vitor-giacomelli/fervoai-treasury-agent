from __future__ import annotations

import asyncio
import hmac
import logging
import os
import time
from collections import defaultdict, deque
from collections.abc import AsyncGenerator
from typing import Deque

from fastapi import FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from orchestrator import run_treasury_workflow

app = FastAPI(title="fervoAI.treasury Backend")
logger = logging.getLogger(__name__)


def _parse_bool_env(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_int_env(value: str | None, default: int) -> int:
    if value is None:
        return default
    try:
        parsed = int(value.strip())
        return parsed if parsed > 0 else default
    except ValueError:
        return default


STREAM_API_KEY = os.getenv("STREAM_API_KEY", "").strip()
REQUIRE_STREAM_API_KEY = _parse_bool_env(os.getenv("REQUIRE_STREAM_API_KEY"), default=True)
STREAM_RATE_LIMIT_REQUESTS = _parse_int_env(os.getenv("STREAM_RATE_LIMIT_REQUESTS"), default=8)
STREAM_RATE_LIMIT_WINDOW_SECONDS = _parse_int_env(os.getenv("STREAM_RATE_LIMIT_WINDOW_SECONDS"), default=60)
MAX_CONCURRENT_STREAMS = _parse_int_env(os.getenv("MAX_CONCURRENT_STREAMS"), default=12)
ENFORCE_STREAM_AUTH = REQUIRE_STREAM_API_KEY and bool(STREAM_API_KEY)

stream_semaphore = asyncio.Semaphore(MAX_CONCURRENT_STREAMS)
rate_limit_lock = asyncio.Lock()
rate_limit_hits: dict[str, Deque[float]] = defaultdict(deque)

if REQUIRE_STREAM_API_KEY and not STREAM_API_KEY:
    logger.warning(
        "REQUIRE_STREAM_API_KEY is enabled but STREAM_API_KEY is not configured. "
        "Auth enforcement is temporarily disabled for availability until STREAM_API_KEY is set."
    )


def _extract_client_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for", "")
    if forwarded_for:
        first_ip = forwarded_for.split(",")[0].strip()
        if first_ip:
            return first_ip
    real_ip = request.headers.get("x-real-ip", "").strip()
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def _verify_stream_api_key(x_api_key: str | None) -> None:
    if not ENFORCE_STREAM_AUTH:
        return
    provided_key = (x_api_key or "").strip()
    if not provided_key or not hmac.compare_digest(provided_key, STREAM_API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized workflow access.",
        )


async def _enforce_rate_limit(client_id: str) -> None:
    now = time.monotonic()
    window_start = now - STREAM_RATE_LIMIT_WINDOW_SECONDS
    async with rate_limit_lock:
        bucket = rate_limit_hits[client_id]
        while bucket and bucket[0] < window_start:
            bucket.popleft()
        if len(bucket) >= STREAM_RATE_LIMIT_REQUESTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Retry shortly.",
            )
        bucket.append(now)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:4173",
        "http://127.0.0.1:4173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/stream_workflow")
async def stream_workflow(
    request: Request,
    query: str = Query("start"),
    demo_mode: bool | None = Query(None),
    api_key: str | None = Query(default=None),
    x_api_key: str | None = Header(default=None, alias="X-API-Key"),
) -> StreamingResponse:
    _verify_stream_api_key(x_api_key or api_key)
    await _enforce_rate_limit(_extract_client_identifier(request))

    env_default_demo_mode = _parse_bool_env(os.getenv("DEMO_MODE"), default=False)
    resolved_demo_mode = demo_mode if demo_mode is not None else env_default_demo_mode

    async def guarded_workflow() -> AsyncGenerator[str, None]:
        async with stream_semaphore:
            async for chunk in run_treasury_workflow(query=query, demo_mode=resolved_demo_mode):
                yield chunk

    return StreamingResponse(
        guarded_workflow(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    )


@app.get("/")
async def root() -> JSONResponse:
    return JSONResponse(
        {
            "service": "fervoAI.treasury",
            "stream_endpoint": "/api/stream_workflow?query=start",
        }
    )
