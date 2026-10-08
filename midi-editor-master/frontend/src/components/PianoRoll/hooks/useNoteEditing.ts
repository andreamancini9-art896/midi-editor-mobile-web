import { useCallback, useRef } from 'react';
import type { MidiNote } from '../../../types/midi';
import { useProjectStore } from '../../../stores/useProjectStore';
import { useEditorStore } from '../../../stores/useEditorStore';
import { createNoteId, quantizeBeat } from '../../../utils/midi';

const MIN_NOTE_DURATION = 0.0625;
const EDGE_HIT_PX = 8;

export function useNoteEditing() {
  const dragState = useRef<{
    type: 'draw' | 'move' | 'resize-left' | 'resize-right' | 'erase';
    noteId?: string;
    origNote?: MidiNote;
    startBeat: number;
    startPitch: number;
    trackIndex: number;
  } | null>(null);

  const screenToBeatPitch = useCallback(
    (canvasX: number, canvasY: number, canvasH: number) => {
      const { viewport } = useEditorStore.getState();
      // Inverse of the drawing formula: y = canvasH - (pitch - scrollTop) * zoomY - zoomY
      const pitch = viewport.scrollTop + (canvasH - canvasY) / viewport.zoomY - 1;
      return {
        beat: Math.max(0, canvasX / viewport.zoomX + viewport.scrollLeft),
        pitch: Math.round(Math.max(0, Math.min(127, pitch))),
      };
    },
    [],
  );

  const findNoteAt = useCallback(
    (px: number, py: number, canvasH: number): { note: MidiNote; edge: 'left' | 'right' | 'body' } | null => {
      const { viewport } = useEditorStore.getState();
      const { project } = useProjectStore.getState();

      for (const track of project.tracks) {
        for (const note of track.notes) {
          const nx = (note.startTime - viewport.scrollLeft) * viewport.zoomX;
          const ny = canvasH - (note.pitch - viewport.scrollTop) * viewport.zoomY - viewport.zoomY;
          const nw = Math.max(4, note.duration * viewport.zoomX);
          const nh = viewport.zoomY;

          if (px >= nx - 2 && px <= nx + nw + 2 && py >= ny && py <= ny + nh) {
            if (px <= nx + EDGE_HIT_PX) return { note, edge: 'left' };
            if (px >= nx + nw - EDGE_HIT_PX) return { note, edge: 'right' };
            return { note, edge: 'body' };
          }
        }
      }
      return null;
    },
    [],
  );

  const commitEdit = useCallback((noteId: string, updates: Partial<MidiNote>) => {
    const { project, updateTrack } = useProjectStore.getState();
    for (const track of project.tracks) {
      const idx = track.notes.findIndex((n) => n.id === noteId);
      if (idx !== -1) {
        updateTrack(track.id, { notes: track.notes.map((n, i) => (i === idx ? { ...n, ...updates } : n)) });
        return;
      }
    }
  }, []);

  const deleteNote = useCallback((noteId: string) => {
    const { project, updateTrack } = useProjectStore.getState();
    for (const track of project.tracks) {
      if (track.notes.some((n) => n.id === noteId)) {
        updateTrack(track.id, { notes: track.notes.filter((n) => n.id !== noteId) });
        return;
      }
    }
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>, trackIndex: number) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { beat, pitch } = screenToBeatPitch(x, y, rect.height);
      const tool = useEditorStore.getState().tool;
      const snap = useEditorStore.getState().snapToGrid;
      const grid = useEditorStore.getState().gridSize;
      const snappedBeat = snap ? quantizeBeat(beat, grid) : beat;

      if (tool === 'draw') {
        const hit = findNoteAt(x, y, rect.height);
        if (hit) {
          // Draw mode: click on existing note → enter move mode (drag to reposition)
          useEditorStore.getState().setSelection({ noteIds: [hit.note.id], range: null });
          dragState.current = {
            type: 'move', noteId: hit.note.id, origNote: { ...hit.note },
            startBeat: beat, startPitch: pitch, trackIndex,
          };
        } else {
          // Draw mode: click on empty space → create new note + enter resize
          const noteId = createNoteId();
          const { project, updateTrack } = useProjectStore.getState();
          const track = project.tracks[trackIndex];
          if (!track) return;

          const newNote: MidiNote = {
            id: noteId, pitch, startTime: snappedBeat, duration: grid, velocity: 80, track: trackIndex,
          };
          updateTrack(track.id, { notes: [...track.notes, newNote] });
          dragState.current = {
            type: 'draw', noteId, origNote: newNote, startBeat: snappedBeat, startPitch: pitch, trackIndex,
          };
        }
      } else if (tool === 'select') {
        const hit = findNoteAt(x, y, rect.height);
        if (hit) {
          useEditorStore.getState().setSelection({ noteIds: [hit.note.id], range: null });
          if (hit.edge === 'left') {
            dragState.current = { type: 'resize-left', noteId: hit.note.id, origNote: { ...hit.note }, startBeat: beat, startPitch: pitch, trackIndex };
          } else if (hit.edge === 'right') {
            dragState.current = { type: 'resize-right', noteId: hit.note.id, origNote: { ...hit.note }, startBeat: beat, startPitch: pitch, trackIndex };
          } else {
            dragState.current = { type: 'move', noteId: hit.note.id, origNote: { ...hit.note }, startBeat: beat, startPitch: pitch, trackIndex };
          }
        } else {
          useEditorStore.getState().clearSelection();
        }
      } else if (tool === 'erase') {
        const hit = findNoteAt(x, y, rect.height);
        if (hit) deleteNote(hit.note.id);
        dragState.current = { type: 'erase', startBeat: beat, startPitch: pitch, trackIndex };
      }
    },
    [screenToBeatPitch, findNoteAt, commitEdit, deleteNote],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const ds = dragState.current;
      if (!ds) return;

      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const { beat, pitch } = screenToBeatPitch(x, y, rect.height);
      const snap = useEditorStore.getState().snapToGrid;
      const grid = useEditorStore.getState().gridSize;
      const snapBeat = snap ? quantizeBeat(beat, grid) : beat;

      if (ds.type === 'move' && ds.origNote) {
        const deltaBeat = snapBeat - ds.startBeat;
        const deltaPitch = pitch - ds.startPitch;
        commitEdit(ds.noteId!, {
          startTime: Math.max(0, ds.origNote.startTime + deltaBeat),
          pitch: Math.max(0, Math.min(127, ds.origNote.pitch + deltaPitch)),
        });
      } else if ((ds.type === 'resize-right' || ds.type === 'draw') && ds.origNote) {
        commitEdit(ds.noteId!, { duration: Math.max(MIN_NOTE_DURATION, snapBeat - ds.origNote.startTime) });
      } else if (ds.type === 'resize-left' && ds.origNote) {
        const origEnd = ds.origNote.startTime + ds.origNote.duration;
        const newStart = Math.min(snapBeat, origEnd - MIN_NOTE_DURATION);
        commitEdit(ds.noteId!, { startTime: Math.max(0, newStart), duration: origEnd - newStart });
      } else if (ds.type === 'erase') {
        const hit = findNoteAt(x, y, rect.height);
        if (hit) deleteNote(hit.note.id);
      }
    },
    [screenToBeatPitch, findNoteAt, commitEdit, deleteNote],
  );

  const onPointerUp = useCallback(() => {
    dragState.current = null;
  }, []);

  return { onPointerDown, onPointerMove, onPointerUp };
}
