# MIDI Music Editor — Project Guide

## Overview
Single-user desktop music tool: upload audio/humming → AI converts to MIDI → piano roll editing → export standard MIDI files. React + TypeScript frontend, Python 3.11 FastAPI backend.

## Quick Start
```bash
# Backend (first time)
cd backend
python3.11 -m venv ../venv
source ../venv/Scripts/activate  # Windows Git Bash
# or: ../venv/bin/activate       # Linux/macOS
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev
```

## Coding Standards
- TypeScript strict mode; no `any`
- React functional components + Hooks only
- One component per file
- Zustand stores split by domain (project, editor, player)
- Python: mypy strict, all type annotations required
- camelCase for frontend, snake_case for backend
- No new third-party dependencies without discussion
- Canvas drawing logic separated from interaction logic
- All API routes must use Pydantic validation

## Architecture
See ARCHITECTURE_PLAN.md for full details.

### Key constraints
- No database — all MIDI data in memory/JSON
- No auth/user system — local single-user
- Upload limit 50MB
- Mono voice → MIDI (pYIN port in `frontend/src/audio/`), MIDI import/export (`frontend/src/midi/smf.ts`) run in the browser; the Python backend is only used for the optional polyphonic mode (Basic Pitch)
- Canvas rendering must maintain 60fps

### API endpoints (port 8000)
- `POST /api/upload-audio` — upload audio
- `POST /api/convert-to-midi` — audio → MIDI (poly/mono)
- `POST /api/download-midi` — export MIDI file
