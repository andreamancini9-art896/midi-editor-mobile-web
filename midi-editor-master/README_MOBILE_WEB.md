# MIDI Editor Mobile Web

Sing or hum into the phone microphone, get the notes on a piano roll, edit them and export a MIDI file.
**No server needed**: everything runs in the browser.

## What runs where

| Feature | Where |
| --- | --- |
| Microphone recording, audio file decoding | browser (Web Audio / MediaRecorder) |
| Voice -> MIDI (pYIN, same algorithm and defaults as the old `librosa.pyin` backend) | browser, in a Web Worker |
| Piano roll, BPM, grid, playback (Tone.js) | browser |
| MIDI export / import | browser (`src/midi/smf.ts`) |
| Polyphonic mode "Poly (Instruments)" (Basic Pitch) | optional Python server, only if `VITE_API_URL` is set |

## Local test

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`. The microphone works on `localhost` and on `https://` pages only:
opening the dev server from the phone through `http://192.168.x.x` will not give microphone access.

## Phone / Internet

Deploy the static site (`render.yaml`, or any static host: Netlify, GitHub Pages, Cloudflare Pages...):

- build command: `npm ci && npm run build`, publish directory: `frontend/dist`

Then open the HTTPS URL in Chrome on Android and use menu -> Add to Home screen / Install app.

## Notes on the conversion

- Notes are placed on the beat grid using the current project BPM (`beat = seconds * BPM / 60`),
  so set the BPM **before** converting. The piano roll, the playback and the exported MIDI file now all share the same timing.
- Detection range is C2-C7, notes shorter than 30 ms are dropped, frames with voiced probability < 0.6 count as silence
  (same values as `convert_monophonic` in the backend).
- Exported tracks use melodic MIDI channels (never channel 10, which is the drum channel).

## Optional backend (polyphonic mode)

The `backend/` folder is unchanged. To enable the Poly mode: run/deploy it, set `CORS_ORIGINS` on the server and
`VITE_API_URL` when building the frontend (see the commented block in `render.yaml`).
