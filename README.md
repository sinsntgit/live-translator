# Live Arabic → English Meeting Translator

Real implementation of the design handoff prototype (`Live Translator.dc.html`,
`requirements.md`). See that handoff's README for full behavior spec — this
is the architecture actually chosen and built from it:

- **`packages/client`** — Electron + React (TypeScript) desktop app. Captures
  mic, an uploaded recording, or **system/app audio via `desktopCapturer`
  loopback** (so it can listen to a Teams or Webex window), downsamples to
  16kHz mono PCM16 in an `AudioWorklet`, and streams it to our own backend.
- **`packages/server`** — Node.js/TypeScript backend relay. This is the only
  thing that holds the Soniox API key and the only thing that talks to
  `wss://stt-rt.soniox.com`, per requirements.md §4.3/§5.1. It normalizes
  Soniox's token stream and relays it to the client over its own WebSocket.
- **`packages/shared`** — TypeScript types for the client↔server protocol.

The client **never** connects to Soniox directly and never sees the API key
— that's the key difference from the HTML reference prototype, which opened
the Soniox socket straight from the browser.

## Setup

```bash
npm install
cp packages/server/.env.example packages/server/.env
# edit packages/server/.env and set SONIOX_API_KEY
```

## Run in development

```bash
npm run dev:server      # backend relay on ws://localhost:8787/session
npm run dev:client      # Vite dev server on http://localhost:5173
npm run electron -w packages/client   # Electron shell loading the Vite dev server
```

## Standalone .exe (portable, no components to start)

```bash
npm run package
```

Produces `packages/client/release/LiveInterpret.exe`. Copy it to any folder and
double-click it: it starts its own relay and window, and stops the relay on quit.

- **Configuration lives in a `.env` next to the `.exe`.** On first launch the app
  creates one there (with a placeholder) and asks you to paste your
  `SONIOX_API_KEY` and restart. `PORT` is optional (default 8787).
- Spoken language (Arabic / Thai) is chosen inside the app, not in `.env`.
- Keep the `.exe` in a folder you can write to (not `Program Files`).
- The build is unsigned, so Windows SmartScreen may warn on other machines.

## Build

```bash
npm run build
```

## Notes / follow-ups

- **System audio capture** (Teams/Webex) uses Electron's `desktopCapturer` +
  `setDisplayMediaRequestHandler` with `audio: 'loopback'`. This works on
  Windows and macOS; verify behavior on your target OS versions before
  relying on it in a real meeting.
- **Design system**: `packages/client/src/styles/tokens.css` and
  `global.css` reconstruct the "Industry" design system's tokens and
  "blueprint" component look from the handoff README, since the bound
  stylesheet itself wasn't part of the handoff bundle. Swap in the real
  design-system CSS if it becomes available — the class names
  (`.card.blueprint`, `.tag-accent`, `.seg`, etc.) already match what the
  components use.
- **Transcript persistence**: export-on-demand only for now (matches MVP
  scope in requirements.md §7.1). Server-side transcript persistence
  (requirements.md §3.5) is a straightforward follow-up in
  `packages/server/src/sonioxRelay.ts` / a new session store.
- **Speech-to-speech output**: uses the browser's `SpeechSynthesisUtterance`
  as a placeholder, same as the prototype — real Soniox TTS is Phase 2
  (requirements.md §7.2).
