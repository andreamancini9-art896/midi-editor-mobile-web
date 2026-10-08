# MIDI Editor

A browser-based MIDI music editor with AI-powered audio-to-MIDI conversion. Upload audio or hum a melody, convert it to MIDI, edit in a piano roll, and export standard MIDI files.

## Features

- **Audio to MIDI** — Upload WAV/MP3/OGG files for polyphonic (basic-pitch) or monophonic (pYIN) conversion
- **Voice/Hum to MIDI** — Record directly in browser, convert to MIDI notes
- **Piano Roll Editor** — Draw, select, move, resize, and erase notes on a Canvas-based piano roll
- **Piano Keyboard** — Click keys to preview sounds via Tone.js synthesis
- **MIDI Import/Export** — Load existing .mid files, edit, and export standard MIDI
- **Playback** — Play your MIDI with Tone.js, with auto-scroll follow
- **Undo/Redo** — Full Ctrl+Z / Ctrl+Y support
- **Snap to Grid** — Quantize to 1/1 ~ 1/16 note grids

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State | Zustand |
| Piano Roll | HTML5 Canvas |
| Audio Playback | Tone.js |
| Backend | Python 3.11 + FastAPI |
| Audio→MIDI (poly) | basic-pitch (Spotify, TensorFlow) |
| Audio→MIDI (mono) | librosa pYIN |
| MIDI I/O | pretty_midi |

## Quick Start

### Prerequisites
- Python 3.11
- Node.js 18+

### Backend
```bash
cd backend
python3.11 -m venv ../venv
source ../venv/bin/activate   # or: ../venv/Scripts/activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Project Structure

```
├── frontend/                   # React SPA
│   └── src/
│       ├── components/
│       │   ├── PianoRoll/      # Canvas-based piano roll editor
│       │   ├── Transport/      # Playback controls
│       │   ├── Upload/         # Audio upload + voice recorder
│       │   ├── TrackList/      # Track management
│       │   ├── Toolbar/        # Editing tools
│       │   └── Export/         # MIDI export dialog
│       ├── stores/             # Zustand state (project, editor, player)
│       ├── hooks/              # useAudioToMidi, useMidiPlayback, etc.
│       ├── api/                # FastAPI client
│       ├── types/              # TypeScript type definitions
│       └── utils/              # MIDI and audio utilities
├── backend/
│   └── app/
│       ├── api/                # FastAPI routes
│       ├── services/           # audio_to_midi, midi_io, pitch_detection
│       └── models/             # Pydantic schemas
└── ARCHITECTURE_PLAN.md        # Full architecture documentation
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/upload-audio` | Upload audio file |
| POST | `/api/convert-to-midi` | Audio → MIDI conversion (poly/mono) |
| POST | `/api/download-midi` | Export MIDI file download |
| POST | `/api/import-midi` | Import .mid file → JSON |
| GET | `/health` | Health check |

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| S | Select tool |
| D | Draw tool |
| E | Erase tool |
| G | Toggle snap |
| Space | Play/Pause |
| Delete | Delete selected notes |
| Ctrl+Z | Undo |
| Ctrl+Shift+Z / Ctrl+Y | Redo |
| Ctrl+Scroll | Zoom |
| Shift+Drag | Pan canvas |

## License

MIT
