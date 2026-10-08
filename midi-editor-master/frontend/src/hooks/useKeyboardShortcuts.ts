import { useEffect } from 'react';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useEditorStore } from '../stores/useEditorStore';
import { useProjectStore } from '../stores/useProjectStore';

export function useKeyboardShortcuts() {
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      // Ctrl+Z / Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useProjectStore.getState().redo();
        } else {
          useProjectStore.getState().undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        useProjectStore.getState().redo();
        return;
      }

      switch (e.key) {
        case ' ':
          e.preventDefault();
          {
            const { playState } = usePlayerStore.getState();
            if (playState === 'playing') {
              usePlayerStore.getState().setPlayState('paused');
            } else {
              usePlayerStore.getState().setPlayState('playing');
            }
          }
          break;

        case 'Delete':
        case 'Backspace': {
          e.preventDefault();
          const sel = useEditorStore.getState().selection;
          if (sel.noteIds.length === 0) break;
          const { project, updateTrack } = useProjectStore.getState();
          for (const track of project.tracks) {
            const toDelete = track.notes.filter((n) => sel.noteIds.includes(n.id));
            if (toDelete.length > 0) {
              updateTrack(track.id, {
                notes: track.notes.filter((n) => !sel.noteIds.includes(n.id)),
              });
            }
          }
          useEditorStore.getState().clearSelection();
          break;
        }

        case 's': case 'S': useEditorStore.getState().setTool('select'); break;
        case 'd': case 'D': useEditorStore.getState().setTool('draw'); break;
        case 'e': case 'E': useEditorStore.getState().setTool('erase'); break;
        case 'g': case 'G': useEditorStore.getState().toggleSnap(); break;
      }
    }
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
}
