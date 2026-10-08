import { useCallback, useRef, useState } from 'react';
import { useAudioToMidi } from '../../hooks/useAudioToMidi';
import { formatDuration } from '../../utils/audio';
import { HAS_BACKEND } from '../../api/client';

const MAX_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED = ['.wav', '.mp3', '.ogg', '.flac', '.m4a', '.aac', '.webm'];

export function AudioUploader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'poly' | 'mono'>('mono');
  const [file, setFile] = useState<File | null>(null);
  const { loading, error, progress, process } = useAudioToMidi();

  const handleFile = useCallback((f: File) => {
    const ext = '.' + f.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED.includes(ext)) {
      alert(`Unsupported format. Allowed: ${ALLOWED.join(', ')}`);
      return;
    }
    if (f.size > MAX_SIZE) {
      alert('File exceeds 50MB limit');
      return;
    }
    setFile(f);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile],
  );

  const handleConvert = useCallback(async () => {
    if (!file) return;
    await process(file, mode);
  }, [file, mode, process]);

  return (
    <div className="p-4 bg-[#1e1e30] border-b md:border-r border-gray-700 w-full md:w-72 flex-shrink-0 overflow-y-auto">
      <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">Audio to MIDI</h2>

      {/* Upload area */}
      <div
        className="border-2 border-dashed border-gray-600 rounded-lg p-4 text-center cursor-pointer hover:border-gray-400 transition-colors mb-3"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className="text-3xl mb-1">🎵</div>
        <p className="text-xs text-gray-400">
          {file ? file.name : 'Drop audio or click to browse'}
        </p>
        {file && <p className="text-xs text-gray-500 mt-1">{formatDuration(0)}</p>}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept=".wav,.mp3,.ogg,.flac,.m4a,.aac,.webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />

      {/* Mode toggle */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className="text-gray-400">Mode:</span>
        <button
          className={`px-2 py-1 rounded ${mode === 'poly' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'} disabled:opacity-40 disabled:cursor-not-allowed`}
          disabled={!HAS_BACKEND}
          title={HAS_BACKEND ? undefined : 'Polyphonic mode needs a server (not available in this build)'}
          onClick={() => setMode('poly')}
        >
          Poly (Instruments)
        </button>
        <button
          className={`px-2 py-1 rounded ${mode === 'mono' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          onClick={() => setMode('mono')}
        >
          Mono (Voice)
        </button>
      </div>

      {/* Convert button */}
      <button
        className="w-full py-3 sm:py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!file || loading}
        onClick={handleConvert}
      >
        {loading ? `Converting${progress !== null ? ` ${Math.round(progress * 100)}%` : '...'}` : 'Convert to MIDI'}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-3 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
