/// <reference lib="webworker" />
import { runMonoPyin } from './monoToNotes';

export interface PyinWorkerRequest {
  samples: Float32Array;
}

export type PyinWorkerMessage =
  | { type: 'progress'; fraction: number }
  | { type: 'done'; f0: Float64Array; voicedProb: Float64Array; hopLength: number; sr: number }
  | { type: 'error'; message: string };

const ctx = self as unknown as {
  postMessage(message: PyinWorkerMessage, transfer?: Transferable[]): void;
  onmessage: ((event: MessageEvent<PyinWorkerRequest>) => void) | null;
};

ctx.onmessage = (event) => {
  try {
    let last = 0;
    const result = runMonoPyin(event.data.samples, (fraction) => {
      if (fraction - last >= 0.02) {
        last = fraction;
        ctx.postMessage({ type: 'progress', fraction });
      }
    });
    ctx.postMessage(
      { type: 'done', f0: result.f0, voicedProb: result.voicedProb, hopLength: result.hopLength, sr: result.sr },
      [result.f0.buffer, result.voicedProb.buffer],
    );
  } catch (e) {
    ctx.postMessage({ type: 'error', message: e instanceof Error ? e.message : 'Pitch analysis failed' });
  }
};
