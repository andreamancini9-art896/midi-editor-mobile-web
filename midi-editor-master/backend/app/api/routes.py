import uuid
from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import FileResponse

from app.config import UPLOAD_DIR, MAX_UPLOAD_SIZE, ALLOWED_AUDIO_EXTENSIONS
from app.models.schemas import (
    UploadResponse,
    ConvertRequest,
    ConvertResponse,
    ExportRequest,
    ImportResponse,
    MidiTrackSchema,
)
from app.services.audio_to_midi import convert_polyphonic, convert_monophonic
from app.services.midi_io import export_midi, import_midi

router = APIRouter(prefix="/api")


@router.post("/upload-audio", response_model=UploadResponse)
async def upload_audio(file: UploadFile = File(...)) -> UploadResponse:
    ext = Path(file.filename or "unknown.wav").suffix.lower()
    if ext not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {ext}. Allowed: {ALLOWED_AUDIO_EXTENSIONS}")

    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 50MB limit")

    UPLOAD_DIR.mkdir(exist_ok=True)
    file_id = uuid.uuid4().hex
    dest = UPLOAD_DIR / f"{file_id}{ext}"
    dest.write_bytes(contents)

    return UploadResponse(
        file_id=file_id,
        original_filename=file.filename or "unknown",
        size_bytes=len(contents),
    )


@router.post("/convert-to-midi", response_model=ConvertResponse)
async def convert_to_midi(req: ConvertRequest) -> ConvertResponse:
    candidates = list(UPLOAD_DIR.glob(f"{req.file_id}.*"))
    if not candidates:
        raise HTTPException(status_code=404, detail="Uploaded file not found")
    audio_path = candidates[0]

    if req.mode == "poly":
        notes = convert_polyphonic(audio_path, req.onset_threshold, req.min_note_length)
    else:
        notes = convert_monophonic(audio_path)

    track = MidiTrackSchema(
        name="Track 1",
        instrument=0,
        notes=notes,
        is_muted=False,
        is_solo=False,
    )

    return ConvertResponse(tracks=[track])


@router.post("/download-midi")
async def download_midi(req: ExportRequest) -> FileResponse:
    with NamedTemporaryFile(suffix=".mid", delete=False) as tmp:
        out_path = Path(tmp.name)

    try:
        export_midi(req, out_path)
        return FileResponse(
            path=str(out_path),
            media_type="audio/midi",
            filename="export.mid",
        )
    finally:
        import os
        import asyncio

        async def cleanup() -> None:
            await asyncio.sleep(10)
            try:
                os.unlink(out_path)
            except OSError:
                pass

        asyncio.ensure_future(cleanup())


@router.post("/import-midi", response_model=ImportResponse)
async def import_midi_endpoint(file: UploadFile = File(...)) -> ImportResponse:
    ext = Path(file.filename or "unknown.mid").suffix.lower()
    if ext not in {".mid", ".midi", ".smf"}:
        raise HTTPException(status_code=400, detail=f"Not a MIDI file: {ext}")

    contents = await file.read()
    UPLOAD_DIR.mkdir(exist_ok=True)
    tmp_path = UPLOAD_DIR / f"_import_{uuid.uuid4().hex}{ext}"
    tmp_path.write_bytes(contents)

    try:
        tracks, bpm, ts = import_midi(tmp_path)
        return ImportResponse(bpm=bpm, time_signature=ts, tracks=tracks)
    finally:
        import os
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
