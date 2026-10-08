"""Smoke tests for MIDI I/O and API endpoints."""

from pathlib import Path
import tempfile

from fastapi.testclient import TestClient

from app.main import app
from app.models.schemas import ExportRequest, MidiTrackSchema, MidiNoteSchema
from app.services.midi_io import export_midi

client = TestClient(app)


def test_health() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"


def test_export_empty_track() -> None:
    req = ExportRequest(bpm=120, time_signature=(4, 4), tracks=[])
    with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as tmp:
        out = Path(tmp.name)
    try:
        result = export_midi(req, out)
        assert result.exists()
        assert result.stat().st_size > 0
    finally:
        out.unlink(missing_ok=True)


def test_export_single_note() -> None:
    req = ExportRequest(
        bpm=100,
        time_signature=(3, 4),
        tracks=[
            MidiTrackSchema(
                name="Test",
                instrument=1,
                notes=[MidiNoteSchema(pitch=60, start_time=0, duration=1.0, velocity=100)],
            )
        ],
    )
    with tempfile.NamedTemporaryFile(suffix=".mid", delete=False) as tmp:
        out = Path(tmp.name)
    try:
        result = export_midi(req, out)
        assert result.stat().st_size > 0
    finally:
        out.unlink(missing_ok=True)


def test_export_download_endpoint() -> None:
    req = {
        "bpm": 120,
        "time_signature": [4, 4],
        "tracks": [
            {
                "name": "Piano",
                "instrument": 0,
                "notes": [
                    {"pitch": 60, "start_time": 0, "duration": 1.0, "velocity": 80},
                    {"pitch": 64, "start_time": 1.0, "duration": 0.5, "velocity": 90},
                ],
            }
        ],
    }
    resp = client.post("/api/download-midi", json=req)
    assert resp.status_code == 200
    assert resp.headers["content-type"] == "audio/midi"


def test_import_midi_roundtrip() -> None:
    """Export a MIDI, then import it and verify notes match."""
    from io import BytesIO

    req = {
        "bpm": 100,
        "time_signature": [3, 4],
        "tracks": [
            {
                "name": "Piano",
                "instrument": 0,
                "notes": [
                    {"pitch": 60, "start_time": 0, "duration": 1.0, "velocity": 80},
                    {"pitch": 64, "start_time": 1.0, "duration": 0.5, "velocity": 90},
                ],
            }
        ],
    }
    export_resp = client.post("/api/download-midi", json=req)
    assert export_resp.status_code == 200
    midi_bytes = export_resp.content

    # Import it back
    import_resp = client.post(
        "/api/import-midi",
        files={"file": ("test.mid", BytesIO(midi_bytes), "audio/midi")},
    )
    assert import_resp.status_code == 200
    data = import_resp.json()
    assert data["bpm"] == 100
    assert len(data["tracks"]) == 1
    assert data["tracks"][0]["name"] == "Piano"
    assert len(data["tracks"][0]["notes"]) == 2
