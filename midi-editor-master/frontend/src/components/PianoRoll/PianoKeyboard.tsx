import { useCallback, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { useEditorStore } from '../../stores/useEditorStore';
import { midiToFrequency } from '../../utils/midi';

const KEY_WIDTH = 64;
const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B

// Shared synth for piano preview
let _previewSynth: Tone.Synth | null = null;
function getPreviewSynth(): Tone.Synth {
  if (!_previewSynth) {
    _previewSynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 0.5 },
    }).toDestination();
    _previewSynth.volume.value = -10;
  }
  return _previewSynth;
}

export function PianoKeyboard({ height }: { height: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewport = useEditorStore((s) => s.viewport);

  const draw = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const zoomY = viewport.zoomY;
    const scrollTop = viewport.scrollTop;
    const startPitch = Math.floor(scrollTop);
    const endPitch = Math.ceil(scrollTop + height / zoomY);

    ctx.clearRect(0, 0, KEY_WIDTH, height);

    for (let p = startPitch; p <= endPitch && p < 128; p++) {
      if (p < 0) continue;
      const y = height - (p - scrollTop) * zoomY;
      const isWhite = WHITE_KEYS.includes(p % 12);

      if (isWhite) {
        // White key
        const keyGrad = ctx.createLinearGradient(0, y - zoomY, 0, y);
        keyGrad.addColorStop(0, '#f5f5f5');
        keyGrad.addColorStop(1, '#d8d8d8');
        ctx.fillStyle = keyGrad;
        ctx.fillRect(0, y - zoomY, KEY_WIDTH, zoomY);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, y - zoomY, KEY_WIDTH, zoomY);

        // Note label
        if (zoomY > 10) {
          const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
          ctx.fillStyle = '#555';
          ctx.font = `${Math.min(10, zoomY - 2)}px sans-serif`;
          ctx.fillText(
            `${noteNames[p % 12]}${Math.floor(p / 12) - 1}`,
            4,
            y - zoomY * 0.35,
          );
        }
      } else {
        // Black key
        const blackH = zoomY * 0.55;
        const blackY = y - zoomY * 0.5 - blackH / 2;
        const blackGrad = ctx.createLinearGradient(0, blackY, 0, blackY + blackH);
        blackGrad.addColorStop(0, '#444');
        blackGrad.addColorStop(1, '#222');
        ctx.fillStyle = blackGrad;
        ctx.fillRect(0, blackY, KEY_WIDTH * 0.5, blackH);
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0, blackY, KEY_WIDTH * 0.5, blackH);
      }
    }
  }, [height, viewport]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Click to play note
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const pitch = Math.round(127 - (y / viewport.zoomY + viewport.scrollTop));
      if (pitch < 0 || pitch > 127) return;

      const synth = getPreviewSynth();
      const freq = midiToFrequency(pitch);
      synth.triggerAttackRelease(freq, '16n');

      // Visual feedback: flash the key
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const keyY = height - (pitch - viewport.scrollTop) * viewport.zoomY;
      const isWhite = WHITE_KEYS.includes(pitch % 12);
      ctx.fillStyle = '#ffeb3b';
      ctx.globalAlpha = 0.5;
      if (isWhite) {
        ctx.fillRect(0, keyY - viewport.zoomY, KEY_WIDTH, viewport.zoomY);
      } else {
        const blackH = viewport.zoomY * 0.55;
        const blackY = keyY - viewport.zoomY * 0.5 - blackH / 2;
        ctx.fillRect(0, blackY, KEY_WIDTH * 0.5, blackH);
      }
      ctx.globalAlpha = 1;
      setTimeout(() => draw(), 150);
    },
    [viewport, height, draw],
  );

  return (
    <canvas
      ref={canvasRef}
      width={KEY_WIDTH}
      height={height}
      style={{ width: KEY_WIDTH, height, flexShrink: 0, cursor: 'pointer' }}
      onClick={handleClick}
    />
  );
}
