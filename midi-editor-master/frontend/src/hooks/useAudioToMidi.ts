import { useState } from 'react';
import { HAS_BACKEND, convertToMidi, uploadAudio } from '../api/client';
import { decodeToMono } from '../audio/decodeAudio';
import { analyzeVoice } from '../audio/analyzeVoice';
import { segmentNotes } from '../audio/monoToNotes';
import type { TimedNote } from '../audio/monoToNotes';
import { useProjectStore } from '../stores/useProjectStore';
import { createNoteId, createTrackId } from '../utils/midi';
import type { MidiTrack } from '../types/midi';

const COLORS = ['#4fc3f7', '#f48fb1', '#a5d6a7', '#ffd54f'];

/** Convert notes expressed in seconds to the editor's beat grid at the project tempo. */
function toTrack(notes: TimedNote[], bpm: number, name: string, index: number, instrument = 0): MidiTrack {
  const beatsPerSecond = bpm / 60;
  return {
    id: createTrackId(),
    name,
    instrument,
    notes: notes.map((n) => ({
      id: createNoteId(),
      pitch: n.pitch,
      startTime: n.startTime * beatsPerSecond,
      duration: n.duration * beatsPerSecond,
      velocity: n.velocity,
      track: index,
    })),
    isMuted: false,
    isSolo: false,
    color: COLORS[index % COLORS.length],
  };
}

export function useAudioToMidi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const setTracks = useProjectStore((s) => s.setTracks);

  async function process(file: Blob, mode: 'poly' | 'mono') {
    setLoading(true);
    setError(null);
    setProgress(null);
    try {
      const bpm = useProjectStore.getState().project.bpm;

      if (mode === 'mono') {
        // everything happens on the device: decode → pYIN → notes
        const samples = await decodeToMono(file);
        if (samples.length < 2048) throw new Error('The recording is too short.');
        setProgress(0);
        const result = await analyzeVoice(samples, setProgress);
        const notes = segmentNotes(result);
        if (notes.length === 0) throw new Error('No notes detected. Try singing louder or closer to the microphone.');
        setTracks([toTrack(notes, bpm, 'Track 1', 0)]);
      } else {
        if (!HAS_BACKEND) throw new Error('Polyphonic mode needs a server, which is not configured in this build.');
        const upload = await uploadAudio(file, file instanceof File ? file.name : 'recording.webm');
        const result = await convertToMidi(upload.file_id, 'poly');
        setTracks(
          result.tracks.map((t, i) => {
            const notes: TimedNote[] = t.notes.map((n) => ({
              pitch: n.pitch,
              startTime: n.start_time,
              duration: n.duration,
              velocity: n.velocity,
            }));
            const track = toTrack(notes, bpm, t.name || `Track ${i + 1}`, i, t.instrument);
            return { ...track, isMuted: t.is_muted ?? false, isSolo: t.is_solo ?? false };
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }

  return { loading, error, progress, process };
}
