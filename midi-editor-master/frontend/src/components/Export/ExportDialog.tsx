import { useState, useCallback } from 'react';
import { useProjectStore } from '../../stores/useProjectStore';
import { writeMidi } from '../../midi/smf';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const project = useProjectStore((s) => s.project);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setError(null);
    try {
      const bytes = writeMidi(project);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'audio/midi' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'export.mid';
      a.click();
      URL.revokeObjectURL(url);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [project, onClose]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-[#2a2a40] rounded-lg p-6 w-96 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-4">Export MIDI</h2>

        <div className="text-sm text-gray-400 space-y-2 mb-4">
          <div>BPM: {project.bpm}</div>
          <div>Time: {project.timeSignature[0]}/{project.timeSignature[1]}</div>
          <div>Tracks: {project.tracks.length}</div>
          <div>Notes: {project.tracks.reduce((sum, t) => sum + t.notes.length, 0)}</div>
        </div>

        {error && (
          <div className="mb-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300">
            {error}
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded text-sm"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm disabled:opacity-40"
            disabled={exporting || project.tracks.length === 0}
            onClick={handleExport}
          >
            {exporting ? 'Exporting...' : 'Download .mid'}
          </button>
        </div>
      </div>
    </div>
  );
}
