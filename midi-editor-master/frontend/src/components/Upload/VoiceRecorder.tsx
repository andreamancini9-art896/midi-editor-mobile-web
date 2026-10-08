import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAudioToMidi } from '../../hooks/useAudioToMidi';

export function VoiceRecorder() {
  const [recording, setRecording] = useState(false);
  const [audioFile, setAudioFile] = useState<Blob | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const { loading, error, progress, process } = useAudioToMidi();

  // one object URL per recording (creating it on every render would restart the player)
  const audioUrl = useMemo(() => (audioFile ? URL.createObjectURL(audioFile) : null), [audioFile]);
  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // pick a container this browser can record (Chrome/Android: webm, Safari/iOS: mp4)
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find(
        (t) => typeof MediaRecorder.isTypeSupported === 'function' && MediaRecorder.isTypeSupported(t),
      );
      mediaRecorder.current = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks.current = [];

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = () => {
        const type = mediaRecorder.current?.mimeType || mimeType || 'audio/webm';
        setAudioFile(new Blob(chunks.current, { type }));
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.current.start();
      setRecording(true);
    } catch {
      alert('Microphone access denied or not available.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorder.current?.stop();
    setRecording(false);
  }, []);

  const handleConvert = useCallback(async () => {
    if (!audioFile) return;
    await process(audioFile, 'mono');
  }, [audioFile, process]);

  return (
    <div className="p-3 sm:p-4 bg-[#1e1e30] border-b md:border-r border-gray-700">
      <h2 className="text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wide">Voice / Hum</h2>

      <div className="flex gap-2 mb-3">
        {!recording ? (
          <button
            className="flex-1 py-3 sm:py-2 bg-red-600 hover:bg-red-500 text-white rounded text-sm font-medium"
            onClick={startRecording}
          >
            🎤 Record
          </button>
        ) : (
          <button
            className="flex-1 py-3 sm:py-2 bg-red-800 animate-pulse text-white rounded text-sm font-medium"
            onClick={stopRecording}
          >
            ⏹ Stop
          </button>
        )}
      </div>

      {audioFile && (
        <div className="mb-2">
          <audio controls src={audioUrl ?? undefined} className="w-full h-8" />
          <button
            className="w-full mt-2 py-3 sm:py-2 bg-green-600 hover:bg-green-500 text-white rounded text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={loading}
            onClick={handleConvert}
          >
            {loading ? `Converting${progress !== null ? ` ${Math.round(progress * 100)}%` : '...'}` : 'Convert to MIDI'}
          </button>
        </div>
      )}

      {error && (
        <div className="mt-2 p-2 bg-red-900/50 border border-red-700 rounded text-xs text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
