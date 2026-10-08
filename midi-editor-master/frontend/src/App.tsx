import { useState, useRef, useCallback } from 'react';
import { TransportBar } from './components/Transport/TransportBar';
import { Toolbar } from './components/Toolbar/Toolbar';
import { AudioUploader } from './components/Upload/AudioUploader';
import { VoiceRecorder } from './components/Upload/VoiceRecorder';
import { TrackList } from './components/TrackList/TrackList';
import { PianoRoll } from './components/PianoRoll/PianoRoll';
import { ExportDialog } from './components/Export/ExportDialog';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useProjectStore } from './stores/useProjectStore';
import { readMidi } from './midi/smf';

export default function App() {
  const [showExport, setShowExport] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const setProject = useProjectStore((s) => s.setProject);
  useKeyboardShortcuts();

  const handleImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const project = readMidi(await file.arrayBuffer());
      setProject(project);
    } catch (err) {
      alert('Import failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [setProject]);

  return (
    <div className="h-[100dvh] flex flex-col bg-[#0f0f1a] text-white overflow-hidden">
      <TransportBar />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Toolbar />
        <div className="flex items-center gap-2 pr-4">
          <input
            ref={fileRef}
            type="file"
            accept=".mid,.midi"
            className="hidden"
            onChange={handleImport}
          />
          <button
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded font-medium"
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing...' : 'Import MIDI'}
          </button>
          <button
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded font-medium"
            onClick={() => setShowExport(true)}
          >
            Export MIDI
          </button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden flex-col md:flex-row">
        <div className="flex flex-col w-full md:w-72 flex-shrink-0 max-h-[42dvh] md:max-h-none overflow-y-auto">
          <AudioUploader />
          <VoiceRecorder />
        </div>
        <div className="hidden md:block"><TrackList /></div>
        <PianoRoll />
      </div>

      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}
    </div>
  );
}
