import { useProjectStore } from '../../stores/useProjectStore';
import { createTrackId } from '../../utils/midi';

export function TrackList() {
  const tracks = useProjectStore((s) => s.project.tracks);
  const toggleMute = useProjectStore((s) => s.toggleMute);
  const toggleSolo = useProjectStore((s) => s.toggleSolo);
  const addTrack = useProjectStore((s) => s.addTrack);
  const removeTrack = useProjectStore((s) => s.removeTrack);

  return (
    <div className="w-56 flex-shrink-0 bg-[#1e1e30] border-r border-gray-700 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700">
        <span className="text-xs font-semibold text-gray-400 uppercase">Tracks</span>
        <button
          className="text-blue-400 hover:text-blue-300 text-xs font-bold"
          onClick={() =>
            addTrack({
              id: createTrackId(),
              name: `Track ${tracks.length + 1}`,
              instrument: 0,
              notes: [],
              isMuted: false,
              isSolo: false,
              color: ['#4fc3f7', '#f48fb1', '#a5d6a7', '#ffd54f'][tracks.length % 4],
            })
          }
        >
          + Add
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tracks.map((track) => (
          <div
            key={track.id}
            className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 hover:bg-white/5"
          >
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: track.color }}
            />
            <div className="flex-1 min-w-0">
              <input
                className="bg-transparent text-xs text-gray-300 w-full outline-none border-b border-transparent focus:border-gray-600"
                value={track.name}
                onChange={(e) =>
                  useProjectStore.getState().updateTrack(track.id, { name: e.target.value })
                }
              />
            </div>
            <button
              className={`text-[10px] px-1.5 py-0.5 rounded ${track.isMuted ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-500'}`}
              onClick={() => toggleMute(track.id)}
              title="Mute (M)"
            >
              M
            </button>
            <button
              className={`text-[10px] px-1.5 py-0.5 rounded ${track.isSolo ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-500'}`}
              onClick={() => toggleSolo(track.id)}
              title="Solo (S)"
            >
              S
            </button>
            <button
              className="text-red-400 hover:text-red-300 text-xs"
              onClick={() => removeTrack(track.id)}
              title="Delete track"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
