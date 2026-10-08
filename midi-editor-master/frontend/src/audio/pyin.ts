/**
 * pYIN pitch tracker — TypeScript port of `librosa.pyin` (librosa 1.0.0).
 *
 * Mauch & Dixon, "pYIN: A fundamental frequency estimator using probabilistic
 * threshold distributions", ICASSP 2014.
 *
 * The code follows librosa step by step (same defaults, same quirks) so that the
 * browser gives the same result as the old Python backend:
 *   1. framing with centred zero padding
 *   2. cumulative-mean-normalised difference function (YIN)
 *   3. parabolic interpolation
 *   4. per-frame trough probabilities (Beta prior over thresholds + Boltzmann prior over troughs)
 *   5. Viterbi decoding over 2 * nPitchBins states (voiced / unvoiced)
 *
 * Pure computation: no DOM, so it can run inside a Web Worker or in Node.
 * Only the default Beta(2, 18) threshold prior is supported (closed-form CDF).
 */

export interface PyinOptions {
  fmin: number;
  fmax: number;
  sr: number;
  frameLength?: number;
  hopLength?: number;
  nThresholds?: number;
  boltzmannParameter?: number;
  /** Pitch resolution in semitones (librosa default 0.1). */
  resolution?: number;
  maxTransitionRate?: number;
  switchProb?: number;
  noTroughProb?: number;
  /** Transitions less likely than this are ignored by Viterbi (librosa 1.0 default 1e-4). */
  transitionMinProb?: number;
}

export interface PyinResult {
  /** Estimated f0 in Hz per frame, NaN where the frame is unvoiced. */
  f0: Float64Array;
  voicedFlag: Uint8Array;
  /** Probability that the frame is voiced (from the observation model). */
  voicedProb: Float64Array;
  hopLength: number;
  sr: number;
}

export type ProgressCallback = (fraction: number) => void;

const TINY = 2.2250738585072014e-308; // np.finfo(float64).tiny
const LOG_TINY = Math.log(TINY);

/** MIDI note number → Hz (same formula as librosa.midi_to_hz). */
export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** Hz → fractional MIDI note number (same formula as librosa.hz_to_midi). */
export function hzToMidi(hz: number): number {
  return 12 * (Math.log2(hz) - Math.log2(440)) + 69;
}

/** numpy-style rounding: halves go to the nearest even integer. */
export function roundHalfEven(x: number): number {
  const r = Math.round(x);
  if (Math.abs(x % 1) === 0.5) {
    return r % 2 === 0 ? r : r - 1;
  }
  return r;
}

/** CDF of Beta(2, 18) in closed form. */
function betaCdf2_18(x: number): number {
  const a = Math.pow(1 - x, 18);
  const b = Math.pow(1 - x, 19);
  return 19 * (1 - a) - 18 * (1 - b);
}

/** scipy.stats.boltzmann.pmf(k, lambda, n). */
function boltzmannPmf(k: number, lambda: number, n: number): number {
  return ((1 - Math.exp(-lambda)) * Math.exp(-lambda * k)) / (1 - Math.exp(-lambda * n));
}

/** scipy.signal.get_window('triangle', M, fftbins=False) for odd M. */
function triangleWindow(width: number): Float64Array {
  const w = new Float64Array(width);
  const centre = (width - 1) / 2;
  const denom = (width + 1) / 2;
  for (let i = 0; i < width; i++) {
    w[i] = 1 - Math.abs(i - centre) / denom;
  }
  return w;
}

export function pyin(y: Float32Array, options: PyinOptions, onProgress?: ProgressCallback): PyinResult {
  const sr = options.sr;
  const fmin = options.fmin;
  const fmax = options.fmax;
  const frameLength = options.frameLength ?? 2048;
  const hopLength = options.hopLength ?? Math.floor(frameLength / 4);
  const nThresholds = options.nThresholds ?? 100;
  const boltzmann = options.boltzmannParameter ?? 2;
  const resolution = options.resolution ?? 0.1;
  const maxTransitionRate = options.maxTransitionRate ?? 35.92;
  const switchProb = options.switchProb ?? 0.01;
  const noTroughProb = options.noTroughProb ?? 0.01;
  const transitionMinProb = options.transitionMinProb ?? 1e-4;

  if (!(fmin > 0 && fmin < fmax && fmax <= sr / 2)) {
    throw new Error('pyin: invalid fmin/fmax');
  }
  if (sr / fmin >= frameLength - 1) {
    throw new Error('pyin: fmin too small for frameLength');
  }

  const nFrames = 1 + Math.floor(y.length / hopLength);

  // ---- 1. centred, zero-padded signal ------------------------------------------------------
  const padded = new Float64Array(y.length + frameLength);
  for (let i = 0; i < y.length; i++) padded[i + frameLength / 2] = y[i];

  const minPeriod = Math.floor(sr / fmax);
  const maxPeriod = Math.min(Math.ceil(sr / fmin), frameLength - 1);
  const nPeriods = maxPeriod - minPeriod + 1;

  // ---- priors ------------------------------------------------------------------------------
  const thresholds = new Float64Array(nThresholds + 1);
  for (let k = 0; k <= nThresholds; k++) thresholds[k] = k / nThresholds;
  const betaProbs = new Float64Array(nThresholds);
  for (let k = 0; k < nThresholds; k++) {
    betaProbs[k] = betaCdf2_18(thresholds[k + 1]) - betaCdf2_18(thresholds[k]);
  }

  const binsPerSemitone = Math.ceil(1 / resolution);
  const nPitchBins = Math.floor(12 * binsPerSemitone * Math.log2(fmax / fmin) + 1e-9) + 1;
  const nStates = 2 * nPitchBins;

  // ---- 2-4. observation model, frame by frame ----------------------------------------------
  const obsBins: Int32Array[] = new Array<Int32Array>(nFrames);
  const obsProbs: Float64Array[] = new Array<Float64Array>(nFrames);
  const voicedProb = new Float64Array(nFrames);

  const x = new Float64Array(frameLength);
  const acf = new Float64Array(maxPeriod + 1);
  const cumEnergy = new Float64Array(maxPeriod + 1);
  const diff = new Float64Array(maxPeriod + 1);
  const cmnd = new Float64Array(nPeriods);
  const shifts = new Float64Array(nPeriods);
  const troughIdx: number[] = [];

  for (let f = 0; f < nFrames; f++) {
    const start = f * hopLength;
    for (let j = 0; j < frameLength; j++) x[j] = padded[start + j];

    // autocorrelation up to maxPeriod
    for (let k = 0; k <= maxPeriod; k++) {
      let s = 0;
      const lim = frameLength - k;
      for (let j = 0; j < lim; j++) s += x[j] * x[j + k];
      acf[k] = s;
    }
    // cumulative energy of the first maxPeriod samples
    let run = 0;
    for (let k = 0; k <= maxPeriod; k++) {
      run += x[k] * x[k];
      cumEnergy[k] = run;
    }
    // difference function (librosa zeroes the first cumulative-energy entry before using it)
    diff[0] = 0;
    for (let k = 1; k <= maxPeriod; k++) {
      const sub = k - 1 === 0 ? 0 : cumEnergy[k - 1];
      diff[k] = 2 * (acf[0] - acf[k]) - sub;
    }
    // cumulative mean normalised difference
    let cum = 0;
    for (let k = 1; k <= maxPeriod; k++) {
      cum += diff[k];
      if (k >= minPeriod) {
        cmnd[k - minPeriod] = diff[k] / (cum / k + TINY);
      }
    }

    // parabolic interpolation
    shifts[0] = 0;
    shifts[nPeriods - 1] = 0;
    for (let i = 1; i < nPeriods - 1; i++) {
      const a = cmnd[i + 1] + cmnd[i - 1] - 2 * cmnd[i];
      const b = (cmnd[i + 1] - cmnd[i - 1]) / 2;
      shifts[i] = Math.abs(b) >= Math.abs(a) ? 0 : -b / a;
    }

    // troughs (local minima)
    troughIdx.length = 0;
    if (cmnd[0] < cmnd[1]) troughIdx.push(0);
    for (let i = 1; i < nPeriods - 1; i++) {
      if (cmnd[i] < cmnd[i - 1] && cmnd[i] <= cmnd[i + 1]) troughIdx.push(i);
    }
    if (cmnd[nPeriods - 1] < cmnd[nPeriods - 2]) troughIdx.push(nPeriods - 1);

    const nTroughs = troughIdx.length;
    if (nTroughs === 0) {
      obsBins[f] = new Int32Array(0);
      obsProbs[f] = new Float64Array(0);
      voicedProb[f] = 0;
      continue;
    }

    // number of troughs below each threshold and the rank of each trough among them
    const below = new Int32Array(nThresholds);
    for (let t = 0; t < nTroughs; t++) {
      const h = cmnd[troughIdx[t]];
      for (let k = 0; k < nThresholds; k++) {
        if (h < thresholds[k + 1]) below[k]++;
      }
    }
    const probs = new Float64Array(nTroughs);
    const rank = new Int32Array(nThresholds); // running count per threshold
    let globalMin = 0;
    for (let t = 0; t < nTroughs; t++) {
      const h = cmnd[troughIdx[t]];
      if (h < cmnd[troughIdx[globalMin]]) globalMin = t;
      let p = 0;
      for (let k = 0; k < nThresholds; k++) {
        if (h < thresholds[k + 1]) {
          p += boltzmannPmf(rank[k], boltzmann, below[k]) * betaProbs[k];
          rank[k]++;
        }
      }
      probs[t] = p;
    }
    // thresholds below the global minimum: put the "no trough" mass on it
    const hMin = cmnd[troughIdx[globalMin]];
    let nBelowMin = 0;
    for (let k = 0; k < nThresholds; k++) {
      if (!(hMin < thresholds[k + 1])) nBelowMin++;
    }
    let extra = 0;
    for (let k = 0; k < nBelowMin; k++) extra += betaProbs[k];
    probs[globalMin] += noTroughProb * extra;

    // map troughs to pitch bins (later troughs overwrite earlier ones in the same bin)
    const binMap = new Map<number, number>();
    for (let t = 0; t < nTroughs; t++) {
      if (probs[t] === 0) continue;
      const idx = troughIdx[t];
      const period = minPeriod + idx + shifts[idx];
      const f0 = sr / period;
      let bin = roundHalfEven(12 * binsPerSemitone * Math.log2(f0 / fmin));
      if (bin < 0) bin = 0;
      if (bin > nPitchBins) bin = nPitchBins;
      binMap.set(bin, probs[t]);
    }
    // bin === nPitchBins falls on the first unvoiced state in librosa and is overwritten there
    const bins: number[] = [];
    const ps: number[] = [];
    let vp = 0;
    for (const [bin, p] of binMap) {
      if (bin < nPitchBins) {
        bins.push(bin);
        ps.push(p);
        vp += p;
      }
    }
    obsBins[f] = Int32Array.from(bins);
    obsProbs[f] = Float64Array.from(ps);
    voicedProb[f] = Math.min(1, Math.max(0, vp));

    if (onProgress && f % 64 === 0) onProgress((0.45 * f) / nFrames);
  }

  // ---- 5. Viterbi ---------------------------------------------------------------------------
  const maxSemitonesPerFrame = Math.round((maxTransitionRate * 12 * hopLength) / sr);
  const width = maxSemitonesPerFrame * binsPerSemitone + 1;
  if (width % 2 === 0) throw new Error('pyin: even transition width not supported');
  const half = (width - 1) / 2;
  const win = triangleWindow(width);

  // row-normalised local transition: L[p'][p] = win[p - p' + half] / rowSum[p']
  const rowSum = new Float64Array(nPitchBins);
  for (let p = 0; p < nPitchBins; p++) {
    let s = 0;
    for (let d = -half; d <= half; d++) {
      const q = p + d;
      if (q >= 0 && q < nPitchBins) s += win[d + half];
    }
    rowSum[p] = s;
  }
  // log transition tables for "same voicing" and "switch voicing"; -Infinity if below minimum prob
  const ltSame = new Float64Array(nPitchBins * width);
  const ltSwitch = new Float64Array(nPitchBins * width);
  for (let p = 0; p < nPitchBins; p++) {
    for (let o = 0; o < width; o++) {
      const q = p + o - half;
      const idx = p * width + o;
      if (q < 0 || q >= nPitchBins) {
        ltSame[idx] = -Infinity;
        ltSwitch[idx] = -Infinity;
        continue;
      }
      const local = win[o] / rowSum[p];
      const same = (1 - switchProb) * local;
      const sw = switchProb * local;
      ltSame[idx] = same >= transitionMinProb ? Math.log(same + TINY) : -Infinity;
      ltSwitch[idx] = sw >= transitionMinProb ? Math.log(sw + TINY) : -Infinity;
    }
  }

  const ptr = new Uint16Array(nFrames * nStates);
  let prev = new Float64Array(nStates);
  let cur = new Float64Array(nStates);
  const logObs = new Float64Array(nStates);
  const logInit = Math.log(1 / nStates + TINY);

  const fillLogObs = (f: number): void => {
    logObs.fill(LOG_TINY, 0, nPitchBins);
    const bins = obsBins[f];
    const ps = obsProbs[f];
    for (let i = 0; i < bins.length; i++) logObs[bins[i]] = Math.log(ps[i] + TINY);
    const unvoiced = Math.log((1 - voicedProb[f]) / nPitchBins + TINY);
    logObs.fill(unvoiced, nPitchBins, nStates);
  };

  fillLogObs(0);
  for (let s = 0; s < nStates; s++) prev[s] = logObs[s] + logInit;

  for (let t = 1; t < nFrames; t++) {
    fillLogObs(t);
    const row = t * nStates;
    for (let v = 0; v < 2; v++) {
      for (let p = 0; p < nPitchBins; p++) {
        let best = -Infinity;
        let bestK = 0;
        const pLo = Math.max(0, p - half);
        const pHi = Math.min(nPitchBins - 1, p + half);
        for (let vp = 0; vp < 2; vp++) {
          const lt = vp === v ? ltSame : ltSwitch;
          const base = vp * nPitchBins;
          for (let pp = pLo; pp <= pHi; pp++) {
            const c = prev[base + pp] + lt[pp * width + (p - pp + half)];
            if (c > best) {
              best = c;
              bestK = base + pp;
            }
          }
        }
        const j = v * nPitchBins + p;
        cur[j] = logObs[j] + best;
        ptr[row + j] = bestK;
      }
    }
    const tmp = prev;
    prev = cur;
    cur = tmp;
    if (onProgress && t % 64 === 0) onProgress(0.45 + (0.55 * t) / nFrames);
  }

  // backtrack
  const states = new Int32Array(nFrames);
  let bestState = 0;
  let bestVal = -Infinity;
  for (let s = 0; s < nStates; s++) {
    if (prev[s] > bestVal) {
      bestVal = prev[s];
      bestState = s;
    }
  }
  states[nFrames - 1] = bestState;
  for (let t = nFrames - 2; t >= 0; t--) {
    states[t] = ptr[(t + 1) * nStates + states[t + 1]];
  }

  const f0 = new Float64Array(nFrames);
  const voicedFlag = new Uint8Array(nFrames);
  for (let t = 0; t < nFrames; t++) {
    const s = states[t];
    const bin = s % nPitchBins;
    if (s < nPitchBins) {
      voicedFlag[t] = 1;
      f0[t] = fmin * Math.pow(2, bin / (12 * binsPerSemitone));
    } else {
      f0[t] = NaN;
    }
  }

  onProgress?.(1);
  return { f0, voicedFlag, voicedProb, hopLength, sr };
}
