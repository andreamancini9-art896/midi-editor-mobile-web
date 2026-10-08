import { create } from 'zustand';
import type { MidiTrack, Project } from '../types/midi';

const MAX_HISTORY = 100;

interface ProjectState {
  project: Project;
  history: Project[];
  historyPos: number;

  setProject: (project: Project) => void;
  setTracks: (tracks: MidiTrack[]) => void;
  addTrack: (track: MidiTrack) => void;
  updateTrack: (trackId: string, partial: Partial<MidiTrack>) => void;
  removeTrack: (trackId: string) => void;
  toggleMute: (trackId: string) => void;
  toggleSolo: (trackId: string) => void;
  setBpm: (bpm: number) => void;
  setTimeSignature: (ts: [number, number]) => void;
  undo: () => void;
  redo: () => void;
}

function cloneProject(p: Project): Project {
  return JSON.parse(JSON.stringify(p));
}

export const useProjectStore = create<ProjectState>((set, get) => {
  function snapshot() {
    const s = get();
    const proj = cloneProject(s.project);
    const newHistory = s.history.slice(0, s.historyPos + 1);
    newHistory.push(proj);
    if (newHistory.length > MAX_HISTORY) newHistory.shift();
    set({ history: newHistory, historyPos: newHistory.length - 1 });
  }

  return {
    project: { bpm: 120, timeSignature: [4, 4], tracks: [] },
    history: [],
    historyPos: -1,

    setProject: (project) => set({ project, history: [], historyPos: -1 }),

    setTracks: (tracks) => {
      snapshot();
      set((s) => ({ project: { ...s.project, tracks } }));
    },

    addTrack: (track) => {
      snapshot();
      set((s) => ({ project: { ...s.project, tracks: [...s.project.tracks, track] } }));
    },

    updateTrack: (trackId, partial) => {
      snapshot();
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId ? { ...t, ...partial } : t,
          ),
        },
      }));
    },

    removeTrack: (trackId) => {
      snapshot();
      set((s) => ({
        project: { ...s.project, tracks: s.project.tracks.filter((t) => t.id !== trackId) },
      }));
    },

    toggleMute: (trackId) => {
      snapshot();
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId ? { ...t, isMuted: !t.isMuted, isSolo: false } : t,
          ),
        },
      }));
    },

    toggleSolo: (trackId) => {
      snapshot();
      set((s) => ({
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) =>
            t.id === trackId ? { ...t, isSolo: !t.isSolo, isMuted: false } : t,
          ),
        },
      }));
    },

    setBpm: (bpm) => {
      snapshot();
      set((s) => ({ project: { ...s.project, bpm } }));
    },

    setTimeSignature: (ts) => {
      snapshot();
      set((s) => ({ project: { ...s.project, timeSignature: ts } }));
    },

    undo: () => {
      const s = get();
      if (s.historyPos <= 0) return;
      const newPos = s.historyPos - 1;
      set({ project: cloneProject(s.history[newPos]), historyPos: newPos });
    },

    redo: () => {
      const s = get();
      if (s.historyPos >= s.history.length - 1) return;
      const newPos = s.historyPos + 1;
      set({ project: cloneProject(s.history[newPos]), historyPos: newPos });
    },
  };
});
