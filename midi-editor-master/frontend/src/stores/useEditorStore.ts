import { create } from 'zustand';
import type { EditorViewport, Selection, ToolMode } from '../types/editor';

interface EditorState {
  tool: ToolMode;
  viewport: EditorViewport;
  selection: Selection;
  snapToGrid: boolean;
  gridSize: number; // beats
  setTool: (tool: ToolMode) => void;
  setViewport: (partial: Partial<EditorViewport>) => void;
  setSelection: (selection: Selection) => void;
  clearSelection: () => void;
  toggleSnap: () => void;
  setGridSize: (size: number) => void;
}

const DEFAULT_VIEWPORT: EditorViewport = {
  scrollLeft: 0,
  scrollTop: 60, // C4 roughly centered
  zoomX: 80,     // pixels per beat
  zoomY: 14,     // pixels per semitone
};

export const useEditorStore = create<EditorState>((set) => ({
  tool: 'select',
  viewport: { ...DEFAULT_VIEWPORT },
  selection: { noteIds: [], range: null },
  snapToGrid: true,
  gridSize: 0.25, // 16th note

  setTool: (tool) => set({ tool }),

  setViewport: (partial) =>
    set((s) => ({ viewport: { ...s.viewport, ...partial } })),

  setSelection: (selection) => set({ selection }),

  clearSelection: () => set({ selection: { noteIds: [], range: null } }),

  toggleSnap: () => set((s) => ({ snapToGrid: !s.snapToGrid })),

  setGridSize: (size) => set({ gridSize: size }),
}));
