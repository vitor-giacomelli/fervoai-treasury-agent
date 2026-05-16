from __future__ import annotations

import os

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse

from orchestrator import run_treasury_workflow

app = FastAPI(title="fervoAI.treasury Backend")


def _parse_bool_env(value: str | None, default: bool) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
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
    query: str = Query("start"),
    demo_mode: bool | None = Query(None),
) -> StreamingResponse:
    env_default_demo_mode = _parse_bool_env(os.getenv("DEMO_MODE"), default=False)
    resolved_demo_mode = demo_mode if demo_mode is not None else env_default_demo_mode
    return StreamingResponse(
        run_treasury_workflow(query=query, demo_mode=resolved_demo_mode),
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
