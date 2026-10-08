import { useCallback } from 'react';
import { usePlayerStore } from '../../stores/usePlayerStore';
import { useProjectStore } from '../../stores/useProjectStore';
import { useMidiPlayback } from '../../hooks/useMidiPlayback';

export function TransportBar() {
  const playState = usePlayerStore((s) => s.playState);
  const currentBeat = usePlayerStore((s) => s.currentBeat);
  const bpm = useProjectStore((s) => s.project.bpm);
  const setBpm = useProjectStore((s) => s.setBpm);
  const { play, stop } = useMidiPlayback();

  const togglePlay = useCallback(() => {
    if (playState === 'playing') {
      stop();
    } else {
      play();
    }
  }, [playState, play, stop]);

  const handleBpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseInt(e.target.value, 10);
      if (v > 0) setBpm(v);
    },
    [setBpm],
  );

  return (
    <div className="flex items-center gap-2 sm:gap-4 px-2 sm:px-4 py-2 bg-[#1e1e30] border-b border-gray-700 select-none">
      {/* Transport buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={togglePlay}
          className="w-9 h-9 flex items-center justify-center bg-[#4fc3f7] hover:bg-[#29b6f6] text-black rounded text-sm font-bold"
          title="Play/Pause (Space)"
        >
          {playState === 'playing' ? '⏸' : '▶'}
        </button>
        <button
          onClick={stop}
          className="w-9 h-9 flex items-center justify-center bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
          title="Stop"
        >
          ⏹
        </button>
      </div>

      {/* BPM */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-400">BPM</span>
        <input
          type="number"
          value={bpm}
          onChange={handleBpmChange}
          className="w-16 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-center text-white text-sm"
          min={20}
          max={999}
        />
      </div>

      {/* Position display */}
      <div className="text-xs sm:text-sm text-gray-400 ml-auto">
        Beat {currentBeat.toFixed(1)}
      </div>
    </div>
  );
}
