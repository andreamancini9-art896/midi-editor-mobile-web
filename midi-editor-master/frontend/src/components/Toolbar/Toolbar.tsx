import { useEditorStore } from '../../stores/useEditorStore';
import type { ToolMode } from '../../types/editor';

const TOOLS: { mode: ToolMode; label: string; shortcut: string }[] = [
  { mode: 'select', label: 'Select', shortcut: 'S' },
  { mode: 'draw', label: 'Draw', shortcut: 'D' },
  { mode: 'erase', label: 'Erase', shortcut: 'E' },
];

export function Toolbar() {
  const tool = useEditorStore((s) => s.tool);
  const setTool = useEditorStore((s) => s.setTool);
  const snapToGrid = useEditorStore((s) => s.snapToGrid);
  const toggleSnap = useEditorStore((s) => s.toggleSnap);
  const gridSize = useEditorStore((s) => s.gridSize);
  const setGridSize = useEditorStore((s) => s.setGridSize);

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-2 sm:px-4 py-1.5 bg-[#1e1e30] border-b border-gray-700 text-xs">
      {/* Tool buttons */}
      {TOOLS.map((t) => (
        <button
          key={t.mode}
          onClick={() => setTool(t.mode)}
          className={`px-2.5 py-1 rounded font-medium ${
            tool === t.mode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
          }`}
          title={`${t.label} (${t.shortcut})`}
        >
          {t.label}
        </button>
      ))}

      <div className="w-px h-5 bg-gray-600" />

      {/* Snap + Grid */}
      <label className="flex items-center gap-1.5 text-gray-400 cursor-pointer">
        <input type="checkbox" checked={snapToGrid} onChange={toggleSnap} className="accent-blue-500" />
        Snap
      </label>

      {snapToGrid && (
        <select
          value={gridSize}
          onChange={(e) => setGridSize(parseFloat(e.target.value))}
          className="bg-gray-800 border border-gray-600 rounded px-1.5 py-0.5 text-gray-300 text-xs"
        >
          <option value={1}>1/1</option>
          <option value={0.5}>1/2</option>
          <option value={0.25}>1/4</option>
          <option value={0.125}>1/8</option>
          <option value={0.0625}>1/16</option>
        </select>
      )}
    </div>
  );
}
