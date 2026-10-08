from pathlib import Path
import numpy as np
import librosa

from app.config import MODEL_SAMPLE_RATE


def detect_pitch(audio_path: Path) -> tuple[list[float], list[float], list[float]]:
    """Helper: return raw (times, frequencies, confidences) using pYIN.

    Returns:
        times: time stamps in seconds
        frequencies: detected frequencies in Hz
        confidences: confidence scores [0, 1]
    """
    y, sr = librosa.load(str(audio_path), sr=MODEL_SAMPLE_RATE, mono=True)

    f0, voiced_flag, voiced_prob = librosa.pyin(
        y, fmin=float(librosa.note_to_hz('C2')),
        fmax=float(librosa.note_to_hz('C7')),
        sr=sr,
    )
    times = librosa.times_like(f0, sr=sr)

    freqs: list[float] = [(float(f) if f is not None and not np.isnan(f) else 0.0) for f in f0]
    confs: list[float] = [(float(c) if c is not None else 0.0) for c in voiced_prob]

    return times.tolist(), freqs, confs
