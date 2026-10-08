import { MONO_SAMPLE_RATE } from './monoToNotes';

type OfflineCtor = typeof OfflineAudioContext;

function getOfflineContext(): OfflineCtor {
  const w = window as unknown as { OfflineAudioContext?: OfflineCtor; webkitOfflineAudioContext?: OfflineCtor };
  const Ctor = w.OfflineAudioContext ?? w.webkitOfflineAudioContext;
  if (!Ctor) throw new Error('This browser cannot decode audio (Web Audio API missing).');
  return Ctor;
}

/**
 * Decode any audio file/recording the browser understands (wav, mp3, ogg, m4a, webm…)
 * into mono float samples at `targetRate` — the browser equivalent of
 * `librosa.load(path, sr=22050, mono=True)`.
 */
export async function decodeToMono(
  source: Blob,
  targetRate: number = MONO_SAMPLE_RATE,
): Promise<Float32Array> {
  const Offline = getOfflineContext();
  const bytes = await source.arrayBuffer();

  let decoded: AudioBuffer;
  try {
    // decodeAudioData on an offline context resamples to the context's rate
    decoded = await new Offline(1, 1, targetRate).decodeAudioData(bytes);
  } catch {
    throw new Error('Could not decode this audio. Try a WAV, MP3, OGG or M4A file.');
  }

  // resample explicitly if the browser kept the original rate
  if (decoded.sampleRate !== targetRate) {
    const length = Math.max(1, Math.ceil(decoded.duration * targetRate));
    const ctx = new Offline(1, length, targetRate);
    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(ctx.destination);
    src.start();
    decoded = await ctx.startRendering();
  }

  // average channels → mono
  const channels = decoded.numberOfChannels;
  const out = new Float32Array(decoded.length);
  for (let c = 0; c < channels; c++) {
    const data = decoded.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += data[i] / channels;
  }
  return out;
}
