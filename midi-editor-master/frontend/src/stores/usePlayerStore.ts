import { create } from 'zustand';

type PlayState = 'stopped' | 'playing' | 'paused';

interface PlayerState {
  playState: PlayState;
  currentBeat: number;
  loopStart: number | null;
  loopEnd: number | null;
  setPlayState: (state: PlayState) => void;
  seekTo: (beat: number) => void;
  setLoop: (start: number | null, end: number | null) => void;
  clearLoop: () => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  playState: 'stopped',
  currentBeat: 0,
  loopStart: null,
  loopEnd: null,

  setPlayState: (state) => set({ playState: state }),

  seekTo: (beat) => set({ currentBeat: beat }),

  setLoop: (start, end) => set({ loopStart: start, loopEnd: end }),

  clearLoop: () => set({ loopStart: null, loopEnd: null }),
}));
