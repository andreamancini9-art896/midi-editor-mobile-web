/**
 * Minimal Standard MIDI File reader/writer (format 0/1), no dependencies.
 * Replaces the server-side pretty_midi calls so export/import work offline.
 *
 * Time is stored in beats (quarter notes), the same unit the piano roll uses.
 */
import type { MidiNote, MidiTrack, Project } from '../types/midi';
import { createNoteId, createTrackId } from '../utils/midi';

const PPQ = 480;
const TRACK_COLORS = ['#4fc3f7', '#f48fb1', '#a5d6a7', '#ffd54f', '#ce93d8', '#ffab91'];
// channel 9 is the General MIDI drum channel: melodic tracks must avoid it
const MELODIC_CHANNELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];

// ---------------------------------------------------------------- writing

class ByteWriter {
  private bytes: number[] = [];

  u8(v: number): void {
    this.bytes.push(v & 0xff);
  }
  u16(v: number): void {
    this.u8(v >> 8);
    this.u8(v);
  }
  u32(v: number): void {
    this.u8(v >>> 24);
    this.u8(v >>> 16);
    this.u8(v >>> 8);
    this.u8(v);
  }
  vlq(value: number): void {
    let v = Math.max(0, Math.floor(value));
    const stack = [v & 0x7f];
    v >>>= 7;
    while (v > 0) {
      stack.push((v & 0x7f) | 0x80);
      v >>>= 7;
    }
    for (let i = stack.length - 1; i >= 0; i--) this.u8(stack[i]);
  }
  raw(data: ArrayLike<number>): void {
    for (let i = 0; i < data.length; i++) this.u8(data[i]);
  }
  get length(): number {
    return this.bytes.length;
  }
  toArray(): number[] {
    return this.bytes;
  }
}

function metaEvent(w: ByteWriter, delta: number, type: number, data: ArrayLike<number>): void {
  w.vlq(delta);
  w.u8(0xff);
  w.u8(type);
  w.vlq(data.length);
  w.raw(data);
}

function trackChunk(body: ByteWriter): number[] {
  const out = new ByteWriter();
  out.raw([0x4d, 0x54, 0x72, 0x6b]); // "MTrk"
  out.u32(body.length);
  out.raw(body.toArray());
  return out.toArray();
}

interface RawEvent {
  tick: number;
  order: number; // note-off (0) before note-on (1) at the same tick
  pitch: number;
  velocity: number;
}

export function writeMidi(project: Project): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: number[][] = [];

  // conductor track: tempo + time signature
  const conductor = new ByteWriter();
  const bpm = project.bpm > 0 ? project.bpm : 120;
  const micros = Math.round(60_000_000 / bpm);
  metaEvent(conductor, 0, 0x51, [(micros >> 16) & 0xff, (micros >> 8) & 0xff, micros & 0xff]);
  const [num, den] = project.timeSignature;
  const denPow = Math.max(0, Math.round(Math.log2(den > 0 ? den : 4)));
  metaEvent(conductor, 0, 0x58, [Math.max(1, num) & 0xff, denPow, 24, 8]);
  metaEvent(conductor, 0, 0x2f, []);
  chunks.push(trackChunk(conductor));

  project.tracks.forEach((track, index) => {
    const channel = MELODIC_CHANNELS[index % MELODIC_CHANNELS.length];
    const body = new ByteWriter();
    metaEvent(body, 0, 0x03, encoder.encode(track.name));

    body.vlq(0);
    body.u8(0xc0 | channel);
    body.u8(Math.min(127, Math.max(0, Math.round(track.instrument))));

    const events: RawEvent[] = [];
    for (const note of track.notes) {
      const pitch = Math.min(127, Math.max(0, Math.round(note.pitch)));
      const velocity = Math.min(127, Math.max(1, Math.round(note.velocity)));
      const on = Math.max(0, Math.round(note.startTime * PPQ));
      const off = Math.max(on + 1, Math.round((note.startTime + note.duration) * PPQ));
      events.push({ tick: on, order: 1, pitch, velocity });
      events.push({ tick: off, order: 0, pitch, velocity: 0 });
    }
    events.sort((a, b) => a.tick - b.tick || a.order - b.order || a.pitch - b.pitch);

    let last = 0;
    for (const ev of events) {
      body.vlq(ev.tick - last);
      last = ev.tick;
      body.u8((ev.order === 1 ? 0x90 : 0x80) | channel);
      body.u8(ev.pitch);
      body.u8(ev.velocity);
    }
    metaEvent(body, 0, 0x2f, []);
    chunks.push(trackChunk(body));
  });

  const out = new ByteWriter();
  out.raw([0x4d, 0x54, 0x68, 0x64]); // "MThd"
  out.u32(6);
  out.u16(1); // format 1
  out.u16(chunks.length);
  out.u16(PPQ);
  for (const chunk of chunks) out.raw(chunk);
  return Uint8Array.from(out.toArray());
}

// ---------------------------------------------------------------- reading

class ByteReader {
  pos = 0;
  private readonly data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  get eof(): boolean {
    return this.pos >= this.data.length;
  }
  u8(): number {
    if (this.pos >= this.data.length) throw new Error('Unexpected end of MIDI file');
    return this.data[this.pos++];
  }
  u16(): number {
    return (this.u8() << 8) | this.u8();
  }
  u32(): number {
    return ((this.u8() << 24) | (this.u8() << 16) | (this.u8() << 8) | this.u8()) >>> 0;
  }
  vlq(): number {
    let value = 0;
    for (let i = 0; i < 4; i++) {
      const b = this.u8();
      value = (value << 7) | (b & 0x7f);
      if (!(b & 0x80)) return value;
    }
    throw new Error('Invalid variable-length value in MIDI file');
  }
  bytes(n: number): Uint8Array {
    if (this.pos + n > this.data.length) throw new Error('Unexpected end of MIDI file');
    const slice = this.data.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }
  skip(n: number): void {
    this.bytes(n);
  }
}

interface OpenNote {
  start: number;
  velocity: number;
}

interface ChannelBucket {
  program: number;
  hasProgram: boolean;
  notes: { pitch: number; start: number; end: number; velocity: number }[];
  open: Map<number, OpenNote[]>;
}

export function readMidi(buffer: ArrayBuffer): Project {
  const data = new Uint8Array(buffer);
  const r = new ByteReader(data);

  if (String.fromCharCode(...r.bytes(4)) !== 'MThd') throw new Error('Not a MIDI file');
  const headerLength = r.u32();
  r.u16(); // format (0/1/2): all handled the same way here
  const nTracks = r.u16();
  const division = r.u16();
  if (headerLength > 6) r.skip(headerLength - 6);
  if (division & 0x8000) throw new Error('SMPTE time division is not supported');
  const ppq = division || PPQ;

  let tempoMicros: number | null = null;
  let timeSignature: [number, number] | null = null;
  const decoder = new TextDecoder();
  const tracks: MidiTrack[] = [];

  for (let ti = 0; ti < nTracks && !r.eof; ti++) {
    const id = String.fromCharCode(...r.bytes(4));
    const length = r.u32();
    if (id !== 'MTrk') {
      r.skip(length);
      continue;
    }
    const end = r.pos + length;
    let tick = 0;
    let runningStatus = 0;
    let trackName = '';
    const channels = new Map<number, ChannelBucket>();

    const bucket = (ch: number): ChannelBucket => {
      let b = channels.get(ch);
      if (!b) {
        b = { program: 0, hasProgram: false, notes: [], open: new Map() };
        channels.set(ch, b);
      }
      return b;
    };
    const closeNote = (ch: number, pitch: number): void => {
      const b = bucket(ch);
      const stack = b.open.get(pitch);
      const open = stack?.shift();
      if (open) b.notes.push({ pitch, start: open.start, end: tick, velocity: open.velocity });
    };

    while (r.pos < end) {
      tick += r.vlq();
      let status = r.u8();
      if (status < 0x80) {
        // running status
        r.pos--;
        status = runningStatus;
        if (!status) throw new Error('Invalid MIDI data (running status without a status byte)');
      }

      if (status === 0xff) {
        const type = r.u8();
        const len = r.vlq();
        const payload = r.bytes(len);
        if (type === 0x51 && len === 3 && tempoMicros === null) {
          tempoMicros = (payload[0] << 16) | (payload[1] << 8) | payload[2];
        } else if (type === 0x58 && len >= 2 && timeSignature === null) {
          timeSignature = [payload[0], 2 ** payload[1]];
        } else if (type === 0x03 && !trackName) {
          trackName = decoder.decode(payload).replace(/\0/g, '').trim();
        }
        if (type === 0x2f) break;
        continue;
      }
      if (status === 0xf0 || status === 0xf7) {
        r.skip(r.vlq());
        continue;
      }
      if (status >= 0xf1) {
        // other system messages carry fixed-size data
        if (status === 0xf2) r.skip(2);
        else if (status === 0xf3) r.skip(1);
        continue;
      }

      runningStatus = status;
      const kind = status & 0xf0;
      const ch = status & 0x0f;
      if (kind === 0xc0) {
        const program = r.u8();
        const b = bucket(ch);
        if (!b.hasProgram && b.notes.length === 0 && b.open.size === 0) {
          b.program = program;
          b.hasProgram = true;
        }
      } else if (kind === 0xd0) {
        r.u8();
      } else {
        const d1 = r.u8();
        const d2 = r.u8();
        if (kind === 0x90 && d2 > 0) {
          const b = bucket(ch);
          const stack = b.open.get(d1) ?? [];
          stack.push({ start: tick, velocity: d2 });
          b.open.set(d1, stack);
        } else if (kind === 0x80 || kind === 0x90) {
          closeNote(ch, d1);
        }
      }
    }
    r.pos = end;

    // notes still held at the end of the track are closed there
    for (const b of channels.values()) {
      for (const [pitch, stack] of b.open) {
        for (const open of stack) b.notes.push({ pitch, start: open.start, end: tick, velocity: open.velocity });
      }
      b.open.clear();
    }

    const withNotes = [...channels.entries()].filter(([, b]) => b.notes.length > 0).sort((a, b) => a[0] - b[0]);
    for (const [ch, b] of withNotes) {
      const index = tracks.length;
      const baseName = trackName || `Track ${index + 1}`;
      const name = withNotes.length > 1 ? `${baseName} (ch ${ch + 1})` : baseName;
      const notes: MidiNote[] = b.notes
        .sort((x, y) => x.start - y.start || x.pitch - y.pitch)
        .map((n) => ({
          id: createNoteId(),
          pitch: n.pitch,
          startTime: n.start / ppq,
          duration: Math.max(1, n.end - n.start) / ppq,
          velocity: n.velocity,
          track: index,
        }));
      tracks.push({
        id: createTrackId(),
        name,
        instrument: ch === 9 ? 0 : b.program,
        notes,
        isMuted: false,
        isSolo: false,
        color: TRACK_COLORS[index % TRACK_COLORS.length],
      });
    }
  }

  const bpm = tempoMicros ? Math.round((60_000_000 / tempoMicros) * 100) / 100 : 120;
  return { bpm, timeSignature: timeSignature ?? [4, 4], tracks };
}
