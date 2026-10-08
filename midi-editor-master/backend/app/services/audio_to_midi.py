from pathlib import Path
import numpy as np
import librosa

from app.config import MODEL_SAMPLE_RATE
from app.models.schemas import MidiNoteSchema


def convert_polyphonic(audio_path: Path, onset_threshold: float = 0.5, min_note_length: float = 0.05) -> list[MidiNoteSchema]:
    from basic_pitch.inference import predict

    model_output, midi_data, note_events = predict(
        str(audio_path),
        onset_threshold=onset_threshold,
        minimum_note_length=min_note_length / 1000.0 * 60.0 * 120.0,  # rough beat conversion
    )

    notes: list[MidiNoteSchema] = []
    for instrument in midi_data.instruments:
        for note in instrument.notes:
            notes.append(MidiNoteSchema(
                pitch=note.pitch,
                start_time=note.start,
                duration=note.end - note.start,
                velocity=note.velocity,
            ))

    return sorted(notes, key=lambda n: n.start_time)


def convert_monophonic(audio_path: Path) -> list[MidiNoteSchema]:
    y, sr = librosa.load(str(audio_path), sr=MODEL_SAMPLE_RATE, mono=True)

    # pYIN: probabilistic YIN pitch detection (built into librosa)
    f0, voiced_flag, voiced_prob = librosa.pyin(
        y, fmin=float(librosa.note_to_hz('C2')),
        fmax=float(librosa.note_to_hz('C7')),
        sr=sr,
    )
    times = librosa.times_like(f0, sr=sr)

    notes: list[MidiNoteSchema] = []
    min_confidence = 0.6
    in_note = False
    note_start = 0.0
    note_pitch = 0

    for t, f, vp in zip(times, f0, voiced_prob):
        if f is None or np.isnan(f) or vp is None or vp < min_confidence:
            if in_note:
                dur = t - note_start
                if dur > 0.03:
                    notes.append(MidiNoteSchema(
                        pitch=note_pitch,
                        start_time=float(note_start),
                        duration=float(dur),
                        velocity=64,
                    ))
                in_note = False
            continue

        pitch = int(round(librosa.hz_to_midi(float(f))))

        if not in_note:
            in_note = True
            note_start = float(t)
            note_pitch = pitch
        elif pitch != note_pitch:
            dur = t - note_start
            if dur > 0.03:
                notes.append(MidiNoteSchema(
                    pitch=note_pitch,
                    start_time=float(note_start),
                    duration=float(dur),
                    velocity=64,
                ))
            note_start = float(t)
            note_pitch = pitch

    if in_note and len(times) > 0:
        dur = times[-1] - note_start
        if dur > 0.03:
            notes.append(MidiNoteSchema(
                pitch=note_pitch,
                start_time=float(note_start),
                duration=float(dur),
                velocity=64,
            ))

    return notes
