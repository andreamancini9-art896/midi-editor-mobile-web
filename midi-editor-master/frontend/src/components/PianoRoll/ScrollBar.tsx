import { useCallback, useRef } from 'react';
import { useEditorStore } from '../../stores/useEditorStore';
import { useProjectStore } from '../../stores/useProjectStore';

const MIN_BEATS = 32;
const PADDING_BEATS = 8;

export function ScrollBar({ width }: { width: number }) {
  const barRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const viewport = useEditorStore((s) => s.viewport);
  const setViewport = useEditorStore((s) => s.setViewport);
  const tracks = useProjectStore((s) => s.project.tracks);

  // Calculate total beat range from existing notes
  let maxBeat = MIN_BEATS;
  for (const track of tracks) {
    for (const note of track.notes) {
      const end = note.startTime + note.duration;
      if (end > maxBeat) maxBeat = end;
    }
  }
  maxBeat = Math.max(MIN_BEATS, maxBeat + PADDING_BEATS);

  const visibleBeats = Math.max(1, width / Math.max(1, viewport.zoomX));
  const totalBeats = Math.max(visibleBeats, maxBeat);

  // Thumb calculations
  const trackWidth = Math.max(1, width - 8); // 4px padding each side
  const thumbWidth = Math.max(20, (visibleBeats / totalBeats) * trackWidth);
  const thumbTravel = trackWidth - thumbWidth;
  const scrollRatio = Math.min(1, viewport.scrollLeft / Math.max(1, totalBeats - visibleBeats));
  const thumbLeft = 4 + scrollRatio * thumbTravel;

  const pixelToBeat = useCallback(
    (px: number) => {
      const barRect = barRef.current?.getBoundingClientRect();
      if (!barRect) return 0;
      const relX = px - barRect.left - 4 - thumbWidth / 2;
      const frac = Math.max(0, Math.min(1, relX / thumbTravel));
      return frac * (totalBeats - visibleBeats);
    },
    [thumbTravel, thumbWidth, totalBeats, visibleBeats],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      dragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const newScroll = pixelToBeat(e.clientX);
      setViewport({ scrollLeft: Math.max(0, newScroll) });
    },
    [pixelToBeat, setViewport],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging.current) return;
      const newScroll = pixelToBeat(e.clientX);
      setViewport({ scrollLeft: Math.max(0, newScroll) });
    },
    [pixelToBeat, setViewport],
  );

  const handlePointerUp = useCallback(() => {
    dragging.current = false;
  }, []);

  return (
    <div
      ref={barRef}
      className="relative h-6 flex-shrink-0 bg-[#1a1a30] border-t border-gray-700 cursor-pointer select-none"
      style={{ width }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Track */}
      <div className="absolute top-1/2 -translate-y-1/2 left-1 right-1 h-2 bg-gray-700 rounded-full" />

      {/* Thumb */}
      <div
        className="absolute top-1/2 -translate-y-1/2 h-4 bg-blue-600/60 hover:bg-blue-500/80 rounded-full border border-blue-400/50"
        style={{ left: thumbLeft, width: thumbWidth }}
      />

      {/* Beat labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between px-1 pointer-events-none">
        <span className="text-[9px] text-gray-600">
          Beat {viewport.scrollLeft.toFixed(0)}
        </span>
        <span className="text-[9px] text-gray-600">
          {(viewport.scrollLeft + visibleBeats).toFixed(0)}
        </span>
      </div>
    </div>
  );
}
