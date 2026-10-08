export type ToolMode = 'select' | 'draw' | 'erase';

export interface EditorViewport {
  scrollLeft: number;    // horizontal scroll (beats)
  scrollTop: number;     // vertical scroll (pitch)
  zoomX: number;         // pixels per beat
  zoomY: number;         // pixels per semitone
}

export interface Selection {
  noteIds: string[];
  range: {
    startBeat: number;
    endBeat: number;
    lowPitch: number;
    highPitch: number;
  } | null;
}
