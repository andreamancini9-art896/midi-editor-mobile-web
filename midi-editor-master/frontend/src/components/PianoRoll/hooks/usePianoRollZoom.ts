import { useCallback, useRef } from 'react';
import { useEditorStore } from '../../../stores/useEditorStore';

const MIN_ZOOM_X = 10;
const MAX_ZOOM_X = 300;
const MIN_ZOOM_Y = 4;
const MAX_ZOOM_Y = 40;
const ZOOM_STEP = 1.15;
const PAN_SPEED = 1.0;

export function usePianoRollZoom() {
  const viewport = useEditorStore((s) => s.viewport);
  const setViewport = useEditorStore((s) => s.setViewport);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const container = e.currentTarget as HTMLElement;
      const rect = container.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      if (e.ctrlKey || e.metaKey) {
        // Zoom centered on cursor
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        const newZoomX = Math.max(MIN_ZOOM_X, Math.min(MAX_ZOOM_X, viewport.zoomX * factor));
        const newZoomY = Math.max(MIN_ZOOM_Y, Math.min(MAX_ZOOM_Y, viewport.zoomY * factor));

        // Keep beat under cursor stationary
        const beatAtCursor = viewport.scrollLeft + mx / viewport.zoomX;
        const pitchAtCursor = viewport.scrollTop + (rect.height - my) / viewport.zoomY;

        setViewport({
          zoomX: newZoomX,
          zoomY: newZoomY,
          scrollLeft: Math.max(0, beatAtCursor - mx / newZoomX),
          scrollTop: Math.max(0, Math.min(127, pitchAtCursor - (rect.height - my) / newZoomY)),
        });
      } else {
        // Scroll horizontally + vertically
        setViewport({
          scrollLeft: Math.max(0, viewport.scrollLeft + e.deltaX / viewport.zoomX * PAN_SPEED),
          scrollTop: Math.max(0, Math.min(120, viewport.scrollTop + e.deltaY / viewport.zoomY * PAN_SPEED)),
        });
      }
    },
    [viewport, setViewport],
  );

  // Middle-button / Shift+left drag to pan
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        e.preventDefault();
        isPanning.current = true;
        panStart.current = {
          x: e.clientX,
          y: e.clientY,
          scrollLeft: viewport.scrollLeft,
          scrollTop: viewport.scrollTop,
        };
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
      }
    },
    [viewport],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isPanning.current) return;
      const dx = e.clientX - panStart.current.x;
      const dy = e.clientY - panStart.current.y;
      setViewport({
        scrollLeft: Math.max(0, panStart.current.scrollLeft - dx / viewport.zoomX),
        scrollTop: Math.max(0, Math.min(120, panStart.current.scrollTop - dy / viewport.zoomY)),
      });
    },
    [viewport, setViewport],
  );

  const onPointerUp = useCallback(() => {
    isPanning.current = false;
  }, []);

  return { viewport, setViewport, onWheel, onPointerDown, onPointerMove, onPointerUp };
}
