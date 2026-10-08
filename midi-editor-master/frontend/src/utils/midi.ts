import type { MidiNote, Project } from '../types/midi';

let _noteIdCounter = 0;

export function createNoteId(): string {
  return `note_${Date.now()}_${_noteIdCounter++}`;
}

export function createTrackId(): string {
  return `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function midiToFrequency(pitch: number): number {
  return 440 * Math.pow(2, (pitch - 69) / 12);
}

export function frequencyToMidi(freq: number): number {
  return Math.round(12 * Math.log2(freq / 440) + 69);
}

export function pitchName(pitch: number): string {
  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return `${names[pitch % 12]}${Math.floor(pitch / 12) - 1}`;
}

export function quantizeBeat(beat: number, grid: number): number {
  return Math.round(beat / grid) * grid;
}

export function findNoteAt(
  notes: MidiNote[],
  beat: number,
  pitch: number,
  toleranceX: number,
): MidiNote | null {
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    if (
      beat >= n.startTime &&
      beat <= n.startTime + n.duration &&
      pitch === n.pitch &&
      n.duration <= toleranceX * 2
    ) {
      return n;
    }
  }
  for (let i = notes.length - 1; i >= 0; i--) {
    const n = notes[i];
    if (
      beat >= n.startTime &&
      beat <= n.startTime + n.duration &&
      pitch === n.pitch
    ) {
      return n;
    }
  }
  return null;
}

export function cloneProject(project: Project): Project {
  return JSON.parse(JSON.stringify(project));
}
