# 🟢 fervoAI | Treasury Agent

> **Federal grants should fund innovation, not drain teams in bureaucracy.**  
> Most AI tools in this space are just chat wrappers with prettier buttons. We built autonomous infrastructure.

The **fervoAI Treasury Agent** is a stateful orchestration loop that autonomously finds, scores, and routes federal grant execution. It bypasses semantic noise, hits live government API surfaces, injects dynamic company state, and deploys multi-agent swarm delegations to close the execution loop.


---

## 🧠 The Architecture of Action

The Treasury Agent does not just generate text. It operates in a continuous ReAct loop, streaming its internal cognitive telemetry to a cyber-brutalist frontend HUD.

- **🎯 Semantic Target Acquisition:** Expands strategic business queries into multi-vector searches against the live Grants.gov S2S (System-to-System) API.
- **⚖️ Feasibility Matrix:** Uses Gemini-assisted relevance ranking to score targets against Technical Fit, Compliance Readiness, and Capital Efficiency.
- **🧬 Dynamic State Injection:** Reads company topology live from `fervo_state.json` at runtime. No hardcoded prompts. The agent knows exactly who is on the team and what their domains are.
- **🐝 Swarm Orchestration:** Decomposes the massive grant application into specialized sub-tasks and routes them to the correct human operators (Tech Lead, COO) and autonomous Sub-Agents.

---

## 🖥️ The Three-Act HUD

The frontend is a React-based command center built to visualize the agent's autonomy:

1. **THE HUNT:** A raw, cognitive telemetry terminal exposing the agent's multi-step ReAct reasoning and API strikes in real-time.
2. **THE LOCK:** A high-density "Bento Box" dashboard rendering the synthesized pitch and the Feasibility Matrix.
3. **THE DEPLOY:** A simulated execution layer that dispatches the Swarm tasks to the team via an interactive Audit Log.

---

## 🚀 Quick Start (Deployment)

### Option A: The One-Click Infrastructure (Docker)

```bash
docker compose up --build
```

- Frontend HUD: `http://localhost`
- Backend Engine: `http://localhost:8000/health`

### Option B: Local Processes

```powershell
# 1. Boot the Engine
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# 2. Boot the HUD
cd frontend
npm install
npm run dev
```

- HUD URL: `http://127.0.0.1:4173`

---

## 🏗️ Repository Structure

- `/backend` - The FastAPI asynchronous engine. Contains the core orchestrator, Grants.gov S2S adapter, and the `fervo_state.json` dynamic context file.
- `/frontend` - The React/Tailwind/TypeScript presentation layer. Driven by Server-Sent Events (SSE).
- `/docs` - Deep-dive architecture specs, API contracts, and operational runbooks.
- `/scripts` - Fast-recovery PowerShell scripts for aggressive container rebuilds.

---

## ⚙️ Current Runtime Characteristics

- **Transport:** Server-Sent Events (`text/event-stream`)
- **Stack:** FastAPI + async orchestration + httpx + google-genai -> React + Tailwind
- **Concurrency:** Bounded via async semaphore
- **Resilience:** Deterministic fallback supported via `DEMO_MODE=TRUE` for high-stakes presentations

---

Built for the AI Agent Olympics 2026. Code licensed under MIT. FervoAI.
