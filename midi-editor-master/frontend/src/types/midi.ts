export interface MidiNote {
  id: string;
  pitch: number;       // MIDI note number 0-127
  startTime: number;   // start beat (quarter notes)
  duration: number;    // duration in beats
  velocity: number;    // 0-127
  track: number;       // track index
}

export interface MidiTrack {
  id: string;
  name: string;
  instrument: number;  // GM instrument 0-127
  notes: MidiNote[];
  isMuted: boolean;
  isSolo: boolean;
  color: string;
}

export interface Project {
  bpm: number;
  timeSignature: [number, number];
  tracks: MidiTrack[];
}
