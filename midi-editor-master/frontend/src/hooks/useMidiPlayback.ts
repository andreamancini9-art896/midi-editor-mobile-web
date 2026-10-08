import { useRef, useCallback } from 'react';
import * as Tone from 'tone';
import type { MidiNote } from '../types/midi';
import { midiToFrequency } from '../utils/midi';
import { usePlayerStore } from '../stores/usePlayerStore';
import { useProjectStore } from '../stores/useProjectStore';
import { useEditorStore } from '../stores/useEditorStore';

export function useMidiPlayback() {
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const scheduledIds = useRef<number[]>([]);
  const scrollInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const ensureSynth = useCallback(() => {
    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth).toDestination();
      synthRef.current.volume.value = -6;
    }
    return synthRef.current;
  }, []);

  const scheduleNotes = useCallback((notes: MidiNote[], bpm: number, startOffset: number) => {
    const synth = ensureSynth();
    const secondsPerBeat = 60 / bpm;

    for (const note of notes) {
      const noteStart = (note.startTime - startOffset) * secondsPerBeat;
      if (noteStart < 0) continue;
      const noteDuration = note.duration * secondsPerBeat;
      const freq = midiToFrequency(note.pitch);

      const id = Tone.Transport.schedule(() => {
        synth.triggerAttackRelease(freq, noteDuration);
      }, `+${noteStart}`);
      scheduledIds.current.push(id as unknown as number);
    }
  }, [ensureSynth]);

  const play = useCallback(() => {
    const { project } = useProjectStore.getState();
    const { currentBeat } = usePlayerStore.getState();

    if (!project.tracks.length) return;

    const allNotes = project.tracks
      .filter((t) => !t.isMuted)
      .flatMap((t) => t.notes);

    scheduleNotes(allNotes, project.bpm, currentBeat);

    Tone.Transport.start();
    usePlayerStore.setState({ playState: 'playing' });

    // Update currentBeat and auto-scroll viewport
    const interval = setInterval(() => {
      const beat = Tone.Transport.seconds / (60 / project.bpm);
      usePlayerStore.setState({ currentBeat: beat });

      // Auto-scroll: keep playhead visible
      const vp = useEditorStore.getState().viewport;
      const visibleBeats = (window.innerWidth - 64) / vp.zoomX;
      const followAhead = visibleBeats * 0.75;

      if (beat > vp.scrollLeft + followAhead) {
        useEditorStore.getState().setViewport({
          scrollLeft: beat - visibleBeats * 0.25,
        });
      } else if (beat < vp.scrollLeft) {
        useEditorStore.getState().setViewport({
          scrollLeft: Math.max(0, beat - visibleBeats * 0.1),
        });
      }
    }, 50);
    scrollInterval.current = interval;

    return () => clearInterval(interval);
  }, [scheduleNotes]);

  const stop = useCallback(() => {
    Tone.Transport.stop();
    Tone.Transport.cancel();
    for (const id of scheduledIds.current) {
      Tone.Transport.clear(id);
    }
    scheduledIds.current = [];
    if (scrollInterval.current) clearInterval(scrollInterval.current);
    usePlayerStore.setState({ playState: 'stopped', currentBeat: 0 });
  }, []);

  const pause = useCallback(() => {
    Tone.Transport.pause();
    if (scrollInterval.current) clearInterval(scrollInterval.current);
    usePlayerStore.setState({ playState: 'paused' });
  }, []);

  return { play, stop, pause };
}
