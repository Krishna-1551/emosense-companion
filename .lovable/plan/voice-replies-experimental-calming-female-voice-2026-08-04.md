# Voice Replies (Experimental) — Calming Female Voice

Let EmoSense speak its replies aloud in a warm, calm female voice, toggled by a button in the chat header. Off by default, labelled "Experimental".

## What the user experiences

1. A small speaker button sits next to the mood pill in the chat header, with an "Experimental" tag on first reveal.
2. Turning it on: every new EmoSense reply is spoken aloud in a soft, unhurried female voice while the text stays on screen.
3. While speaking, the button animates (gentle pulsing waveform) and tapping it stops playback instantly.
4. Each AI message bubble also gets a tiny "play" icon so any earlier reply can be replayed on demand — even with the toggle off.
5. The preference persists across sessions (stored locally per user). Crisis/high-risk replies are spoken too, but slower and softer.
6. Nothing is spoken for the user's own messages, nudges are spoken only if the toggle is on.

## Build steps

### 1. Edge function `speak`

- JWT-authenticated, `POST { text }`, returns an SSE audio stream.
- Calls Lovable AI `POST /v1/audio/speech` with `model: openai/gpt-4o-mini-tts`, `stream_format: "sse"`, `response_format: "pcm"`, `voice: "shimmer"` (soft female), and `instructions` steering: gentle, warm, unhurried, therapist-like pacing, slight pauses at commas.
- Forwards the gateway's SSE body unchanged (no buffering) so playback starts within ~1s.
- Strips markdown, emoji, and the `[[emosense-attachments:…]]` tag before synthesis; chunks long replies at sentence boundaries so no request exceeds the model's input cap.
- Surfaces 402 (credits) and 429 (rate limit) to the client as clear JSON errors.

### 2. Client speech layer `src/lib/speech.ts`

- `speak(text, { signal })`: fetches the function with the session token, parses SSE with a tiny inline parser, decodes each base64 PCM chunk, and schedules it on a shared 24 kHz `AudioContext` (resume-on-gesture handling, first chunk scheduled +50 ms, carry-over byte for split samples).
- Single-utterance queue: starting a new reply cancels the previous one via `AbortController`.
- Exposes a `useSpeech()` hook with `{ enabled, toggle, speaking, speak, stop, error }`, persisting `enabled` in `localStorage`.
- Graceful degradation: if the function errors or audio is blocked, the toggle shows a one-time toast and falls back to silence — text chat is never affected.

### 3. UI

- `src/components/VoiceToggle.tsx` — header button (speaker / speaker-off / animated bars while speaking) with tooltip "Voice replies (experimental)".
- `src/components/MessageBubble.tsx` — optional small replay button on assistant bubbles, wired through a callback prop so the bubble stays presentational.
- `src/pages/Index.tsx` — mount the toggle next to the mood meter; in the existing reply handler, call `speak(reply)` when enabled. No change to chat request/response logic.

## Technical notes

- Audio never touches the database; nothing is stored or logged beyond existing message text.
- Voice quality: `shimmer` for a calm female tone, with `instructions` doing the emotional steering; `speed` slightly under 1.0 for a settling cadence.
- Cost is per-request, so speech only fires for new replies or explicit replays — never on history load.
- API key stays server-side in the edge function; the browser only ever talks to `speak`.
