/**
 * Optional backend client.
 *
 * Voice → MIDI (mono), MIDI export and MIDI import now run entirely in the browser.
 * The Python server is only needed for the polyphonic "Poly (Instruments)" mode
 * (Basic Pitch). It is used only when VITE_API_URL is set at build time.
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.trim() ?? '';

/** True when a polyphonic backend has been configured for this build. */
export const HAS_BACKEND = API_URL.length > 0;

const BASE_URL = API_URL.replace(/\/$/, '');

export interface BackendNote {
  pitch: number;
  start_time: number; // seconds
  duration: number; // seconds
  velocity: number;
}

export interface BackendTrack {
  name: string;
  instrument: number;
  notes: BackendNote[];
  is_muted?: boolean;
  is_solo?: boolean;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  if (!HAS_BACKEND) throw new Error('No server configured: polyphonic mode is not available in this build.');
  const res = await fetch(`${BASE_URL}${path}`, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { detail?: string }).detail || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function uploadAudio(file: Blob, filename = 'recording.webm'): Promise<{ file_id: string }> {
  const form = new FormData();
  form.append('file', file, filename);
  return request('/api/upload-audio', { method: 'POST', body: form });
}

export async function convertToMidi(fileId: string, mode: 'poly' | 'mono'): Promise<{ tracks: BackendTrack[] }> {
  return request('/api/convert-to-midi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_id: fileId, mode }),
  });
}
