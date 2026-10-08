import { useEffect, useRef } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';

const BEAT_COLOR = '#333';
const BAR_COLOR = '#555';
const BG_COLOR = '#1a1a2e';

export function GridBackground({ width, height }: { width: number; height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewport = useEditorStore((s) => s.viewport);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, width, height);

    const startBeat = viewport.scrollLeft;
    const endBeat = startBeat + width / viewport.zoomX;

    // Octave bands
    for (let pitch = 0; pitch < 128; pitch++) {
      const y = height - (pitch - viewport.scrollTop) * viewport.zoomY;
      if (pitch % 12 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, y - viewport.zoomY * 6, width, viewport.zoomY * 12);
      }
    }

    // Beat lines
    for (let beat = Math.floor(startBeat); beat <= Math.ceil(endBeat); beat++) {
      const x = (beat - startBeat) * viewport.zoomX;
      ctx.strokeStyle = beat % 4 === 0 ? BAR_COLOR : BEAT_COLOR;
      ctx.lineWidth = beat % 4 === 0 ? 1 : 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
  }, [width, height, viewport]);

  return <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }} />;
}
