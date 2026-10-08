from pathlib import Path
import pretty_midi

from app.models.schemas import ExportRequest, MidiNoteSchema, MidiTrackSchema


def import_midi(file_path: Path) -> tuple[list[MidiTrackSchema], float, tuple[int, int]]:
    """Read a .mid file and return (tracks, bpm, time_signature)."""
    midi = pretty_midi.PrettyMIDI(str(file_path))

    bpm: float = 120.0
    tempos = midi.get_tempo_changes()[1]
    if tempos.size > 0:
        bpm = round(float(tempos[0]), 2)

    ts: tuple[int, int] = (4, 4)
    if midi.time_signature_changes:
        tsc = midi.time_signature_changes[0]
        ts = (tsc.numerator, tsc.denominator)

    tracks: list[MidiTrackSchema] = []
    for i, inst in enumerate(midi.instruments):
        notes: list[MidiNoteSchema] = []
        for note in inst.notes:
            notes.append(MidiNoteSchema(
                pitch=note.pitch,
                start_time=float(note.start),
                duration=float(note.end - note.start),
                velocity=note.velocity,
            ))
        tracks.append(MidiTrackSchema(
            name=inst.name or f"Track {i + 1}",
            instrument=inst.program,
            notes=notes,
        ))

    return tracks, bpm, ts


def export_midi(request: ExportRequest, output_path: Path) -> Path:
    midi = pretty_midi.PrettyMIDI(initial_tempo=request.bpm)

    if request.time_signature != (4, 4):
        midi.time_signature_changes.append(
            pretty_midi.TimeSignature(
                numerator=request.time_signature[0],
                denominator=request.time_signature[1],
                time=0.0,
            )
        )

    for track_data in request.tracks:
        instrument = pretty_midi.Instrument(
            program=track_data.instrument,
            name=track_data.name,
            is_drum=(track_data.instrument == 0),
        )
        for note_data in track_data.notes:
            note = pretty_midi.Note(
                velocity=note_data.velocity,
                pitch=note_data.pitch,
                start=note_data.start_time,
                end=note_data.start_time + note_data.duration,
            )
            instrument.notes.append(note)
        midi.instruments.append(instrument)

    midi.write(str(output_path))
    return output_path
