from pydantic import BaseModel, Field
from typing import Literal


class UploadResponse(BaseModel):
    file_id: str
    original_filename: str
    size_bytes: int


class ConvertRequest(BaseModel):
    file_id: str
    mode: Literal["poly", "mono"] = "poly"
    onset_threshold: float = Field(default=0.5, ge=0.0, le=1.0)
    min_note_length: float = Field(default=0.05, ge=0.0, le=1.0)


class MidiNoteSchema(BaseModel):
    pitch: int = Field(ge=0, le=127)
    start_time: float
    duration: float
    velocity: int = Field(default=64, ge=0, le=127)


class MidiTrackSchema(BaseModel):
    name: str
    instrument: int = Field(default=0, ge=0, le=127)
    notes: list[MidiNoteSchema] = []
    is_muted: bool = False
    is_solo: bool = False


class ConvertResponse(BaseModel):
    bpm: float = 120.0
    time_signature: tuple[int, int] = (4, 4)
    tracks: list[MidiTrackSchema]


class ExportRequest(BaseModel):
    bpm: float = 120.0
    time_signature: tuple[int, int] = (4, 4)
    tracks: list[MidiTrackSchema]


class ImportResponse(BaseModel):
    bpm: float
    time_signature: tuple[int, int]
    tracks: list[MidiTrackSchema]
