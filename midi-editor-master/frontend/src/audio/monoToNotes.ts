import type { PyinResult } from './pyin';
import { hzToMidi, midiToHz, pyin, roundHalfEven } from './pyin';

export interface TimedNote {
  pitch: number;
  /** seconds */
  startTime: number;
  /** seconds */
  duration: number;
  velocity: number;
}

export interface SegmentOptions {
  /** frames with a voiced probability below this are treated as silence */
  minConfidence?: number;
  /** notes shorter than this (seconds) are discarded */
  minNoteSeconds?: number;
  velocity?: number;
}

/** Sample rate the old backend resampled to (MODEL_SAMPLE_RATE). */
export const MONO_SAMPLE_RATE = 22050;

/** Same range as the backend: C2 … C7. */
export const MONO_FMIN = midiToHz(36);
export const MONO_FMAX = midiToHz(96);

export function runMonoPyin(samples: Float32Array, onProgress?: (fraction: number) => void): PyinResult {
  return pyin(samples, { fmin: MONO_FMIN, fmax: MONO_FMAX, sr: MONO_SAMPLE_RATE }, onProgress);
}

/**
 * Turn a pYIN f0 track into discrete notes.
 * Direct port of `convert_monophonic` in backend/app/services/audio_to_midi.py,
 * so defaults (confidence 0.6, minimum 30 ms, velocity 64) are unchanged.
 */
export function segmentNotes(result: PyinResult, options: SegmentOptions = {}): TimedNote[] {
  const minConfidence = options.minConfidence ?? 0.6;
  const minNote = options.minNoteSeconds ?? 0.03;
  const velocity = options.velocity ?? 64;
  const { f0, voicedProb, hopLength, sr } = result;
  const n = f0.length;

  const notes: TimedNote[] = [];
  let inNote = false;
  let noteStart = 0;
  let notePitch = 0;

  const close = (t: number): void => {
    const dur = t - noteStart;
    if (dur > minNote) {
      notes.push({ pitch: notePitch, startTime: noteStart, duration: dur, velocity });
    }
  };

  for (let i = 0; i < n; i++) {
    const t = (i * hopLength) / sr;
    const f = f0[i];
    const vp = voicedProb[i];

    if (Number.isNaN(f) || vp < minConfidence) {
      if (inNote) {
        close(t);
        inNote = false;
      }
      continue;
    }

    const pitch = roundHalfEven(hzToMidi(f));

    if (!inNote) {
      inNote = true;
      noteStart = t;
      notePitch = pitch;
    } else if (pitch !== notePitch) {
      close(t);
      noteStart = t;
      notePitch = pitch;
    }
  }

  if (inNote && n > 0) {
    close(((n - 1) * hopLength) / sr);
  }

  return notes.map((note) => ({
    ...note,
    pitch: Math.min(127, Math.max(0, note.pitch)),
  }));
}

/** Seconds → beats (quarter notes) at the given tempo. */
export function secondsToBeats(notes: TimedNote[], bpm: number): TimedNote[] {
  const k = bpm / 60;
  return notes.map((n) => ({ ...n, startTime: n.startTime * k, duration: n.duration * k }));
}
