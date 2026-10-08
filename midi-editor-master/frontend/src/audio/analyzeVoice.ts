import type { PyinResult } from './pyin';
import { runMonoPyin } from './monoToNotes';
import type { PyinWorkerMessage } from './pyin.worker';

/**
 * Run pYIN off the main thread when possible so the UI stays responsive,
 * and fall back to the main thread if workers are unavailable.
 */
export function analyzeVoice(samples: Float32Array, onProgress?: (fraction: number) => void): Promise<PyinResult> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runMonoPyin(samples, onProgress));
  }

  return new Promise<PyinResult>((resolve, reject) => {
    let worker: Worker;
    try {
      worker = new Worker(new URL('./pyin.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolve(runMonoPyin(samples, onProgress));
      return;
    }

    worker.onmessage = (event: MessageEvent<PyinWorkerMessage>) => {
      const msg = event.data;
      if (msg.type === 'progress') {
        onProgress?.(msg.fraction);
      } else if (msg.type === 'done') {
        worker.terminate();
        const voicedFlag = new Uint8Array(msg.f0.length);
        for (let i = 0; i < voicedFlag.length; i++) voicedFlag[i] = Number.isNaN(msg.f0[i]) ? 0 : 1;
        resolve({
          f0: msg.f0,
          voicedProb: msg.voicedProb,
          voicedFlag,
          hopLength: msg.hopLength,
          sr: msg.sr,
        });
      } else {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };
    worker.onerror = () => {
      worker.terminate();
      // last resort: do it on the main thread
      try {
        resolve(runMonoPyin(samples, onProgress));
      } catch (e) {
        reject(e instanceof Error ? e : new Error('Pitch analysis failed'));
      }
    };
    // send a copy: if the worker fails we still need the original for the main-thread fallback
    const copy = samples.slice();
    worker.postMessage({ samples: copy }, [copy.buffer]);
  });
}
