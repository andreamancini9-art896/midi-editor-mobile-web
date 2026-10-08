import { useEffect, useRef, useCallback } from 'react';
import type { MidiNote } from '../../types/midi';
import { useEditorStore } from '../../stores/useEditorStore';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useNoteEditing } from './hooks/useNoteEditing';

export function NoteCanvas({
  width,
  height,
  notes,
  trackIndex,
}: {
  width: number;
  height: number;
  notes: MidiNote[];
  trackIndex: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewport = useEditorStore((s) => s.viewport);
  const selection = useEditorStore((s) => s.selection);
  const currentBeat = usePlayerStore((s) => s.currentBeat);
  const { onPointerDown, onPointerMove, onPointerUp } = useNoteEditing();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, width, height);

    const { scrollLeft, scrollTop, zoomX, zoomY } = viewport;

    // Playhead
    const phx = (currentBeat - scrollLeft) * zoomX;
    if (phx >= 0 && phx <= width) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(phx, 0);
      ctx.lineTo(phx, height);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Notes
    for (const note of notes) {
      const x = (note.startTime - scrollLeft) * zoomX;
      const y = height - (note.pitch - scrollTop) * zoomY - zoomY;
      const w = Math.max(2, note.duration * zoomX);
      const h = zoomY - 0.5;

      if (x + w < 0 || x > width || y + h < 0 || y > height) continue;

      const isSelected = selection.noteIds.includes(note.id);
      const alpha = note.velocity / 127;

      // Note body
      const grad = ctx.createLinearGradient(x, y, x, y + h);
      if (isSelected) {
        grad.addColorStop(0, `rgba(255,220,80,${0.5 + alpha * 0.5})`);
        grad.addColorStop(1, `rgba(255,180,40,${0.5 + alpha * 0.5})`);
      } else {
        grad.addColorStop(0, `rgba(79,195,247,${0.35 + alpha * 0.65})`);
        grad.addColorStop(1, `rgba(30,150,220,${0.35 + alpha * 0.65})`);
      }
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, w, h);

      ctx.strokeStyle = isSelected ? '#ffc832' : 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y, w, h);

      // Velocity indicator
      if (w > 8) {
        ctx.fillStyle = `rgba(255,255,255,${0.2 + alpha * 0.8})`;
        ctx.fillRect(x + 1, y + 1, Math.max(2, w * alpha), 2);
      }
    }
  }, [width, height, notes, viewport, selection, currentBeat]);

  useEffect(() => {
    const rafId = requestAnimationFrame(() => draw());
    return () => cancelAnimationFrame(rafId);
  }, [draw]);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => { onPointerDown(e, trackIndex); },
    [onPointerDown, trackIndex],
  );

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: 'absolute', top: 0, left: 0, cursor: 'crosshair', touchAction: 'none' }}
      onPointerDown={handlePointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    />
  );
}
