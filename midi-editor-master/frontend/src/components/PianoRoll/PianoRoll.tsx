import { useRef, useEffect, useState } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { PianoKeyboard } from './PianoKeyboard';
import { GridBackground } from './GridBackground';
import { NoteCanvas } from './NoteCanvas';
import { ScrollBar } from './ScrollBar';
import { usePianoRollZoom } from './hooks/usePianoRollZoom';

const KEYBOARD_WIDTH = 64;
const SCROLLBAR_HEIGHT = 20;

export function PianoRoll() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const { onWheel, onPointerDown, onPointerMove, onPointerUp } = usePianoRollZoom();
  const tracks = useProjectStore((s) => s.project.tracks);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width: Math.floor(width), height: Math.floor(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (tracks.length === 0) {
    return (
      <div ref={containerRef} className="flex-1 flex items-center justify-center bg-[#16162a] text-gray-500 text-sm">
        Upload audio and convert to MIDI to see notes here. Or create a new track to start drawing.
      </div>
    );
  }

  const canvasWidth = Math.max(100, size.width - KEYBOARD_WIDTH);
  const canvasHeight = Math.max(100, size.height - SCROLLBAR_HEIGHT);

  return (
    <div
      ref={containerRef}
      className="flex-1 min-h-[55dvh] flex flex-col overflow-hidden bg-[#16162a] select-none"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ cursor: 'default' }}
    >
      {/* Track headers */}
      <div className="flex border-b border-gray-700" style={{ height: 28, minHeight: 28 }}>
        <div style={{ width: KEYBOARD_WIDTH, minWidth: KEYBOARD_WIDTH }} className="text-xs text-gray-400 px-2 py-1 flex items-center">
          Keys
        </div>
        <div className="flex-1 flex overflow-hidden">
          {tracks.map((t) => (
            <div key={t.id} className="flex-1 text-xs text-gray-300 px-3 py-1 flex items-center border-l border-gray-700">
              <span className="inline-block w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: t.color }} />
              {t.name}
            </div>
          ))}
        </div>
      </div>

      {/* Canvas area */}
      <div className="flex" style={{ height: canvasHeight, overflow: 'hidden' }}>
        {/* Piano keyboard (fixed left) */}
        <div style={{ width: KEYBOARD_WIDTH, flexShrink: 0, overflow: 'hidden' }}>
          <PianoKeyboard height={canvasHeight} />
        </div>

        {/* Grid + notes (scrollable via viewport) */}
        <div className="flex-1 relative" style={{ overflow: 'hidden' }}>
          {tracks.map((t, i) => (
            <div
              key={t.id}
              style={{
                position: 'absolute',
                top: i === 0 ? 0 : `${(i / tracks.length) * 100}%`,
                left: 0,
                width: '100%',
                height: tracks.length === 1 ? '100%' : `${100 / tracks.length}%`,
              }}
            >
              <GridBackground width={canvasWidth} height={canvasHeight} />
              <NoteCanvas
                width={canvasWidth}
                height={canvasHeight}
                notes={t.notes}
                trackIndex={i}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Horizontal scrollbar */}
      <ScrollBar width={size.width} />
    </div>
  );
}
