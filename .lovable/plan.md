# Multimodal Emotional Analysis Plan

Add voice, image, and document inputs to the EmoSense chat. Each input is transcribed/extracted server-side, then analyzed by the same emotional engine that already handles text — keeping language detection (Hindi/Hinglish/English), emotion, intensity, sentiment, and risk consistent across modalities.

## Backend

### New edge function: `ingest-attachment`
- Accepts a single attachment per call: `{ kind: "image" | "audio" | "document", filename, mime, base64 }`.
- Routes by kind:
  - **Image** → Lovable AI Gateway (`google/gemini-2.5-flash`, multimodal): OCR all visible text + describe visible emotional cues (facial expression, posture, scene mood). Returns `extractedText` + `visualCues`.
  - **Audio** (webm/mp3/wav/m4a) → Lovable AI Gateway STT-capable model (`google/gemini-2.5-flash` with inline audio) for Hindi/Hinglish/English transcription + speaking-pattern hints (hesitation, urgency, intensity).
  - **Document**:
    - `text/plain` → decode base64 directly.
    - `application/pdf` → use `npm:unpdf` (pure JS, Deno-compatible) to extract text.
    - `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (DOCX) → use `npm:mammoth` to extract raw text.
    - `.doc` legacy → not supported, return friendly error asking for DOCX/PDF.
    - Then summarize key points + emotional patterns via Lovable AI.
- Returns a structured JSON: `{ extractedText, summary, language, emotion, intensity, sentimentScore, riskScore, visualCues?, speakingPatterns?, strategy }`.

### Update `chat` edge function
- Accept optional `attachments: AttachmentAnalysis[]` in body.
- Prepend a synthesized context block to the user message before sending to model:
  ```
  [User shared a <kind> "<filename>"]
  Extracted: ...
  Summary: ...
  Visual cues / Speaking patterns: ...
  Detected language: ..., emotion: ..., intensity: ...
  ```
- Reuse existing language detection, repetition guards, time-aware, evolution blocks. The combined emotion (text + attachment) feeds the same emotion/risk pipeline.
- Persist attachment metadata as part of the saved user message content (so it appears in history and bumps `recurring_topics`).

## Frontend

### Composer additions in `src/pages/Index.tsx`
- Add three small icon buttons next to the input: **Mic** (record), **Image** (upload), **Paperclip** (PDF/DOC/TXT).
- Hidden `<input type="file" accept=...>` per type. Use `MediaRecorder` API for voice (webm/opus).
- On selection: convert to base64, call `supabase.functions.invoke("ingest-attachment", ...)`, show a pending chip with filename + spinner.
- When analysis returns, attach it to the next `send()` call as `attachments: [analysis]`. The user's bubble shows: filename + detected emotion/intensity chip.

### Voice recording
- Inline recorder: click Mic → records → click Stop → uploads. Show waveform/level via simple animated bar.
- Limit 60s max.

### New component
- `src/components/AttachmentComposer.tsx`: encapsulates file picker buttons, recorder, base64 conversion, and emits `onReady(analysis)`.
- `src/components/AttachmentChip.tsx`: renders attached file pill in the message bubble.

## Storage (optional, light)
- Skip Supabase Storage for now — keep files transient; only the extracted analysis is persisted in `messages.content` (as a JSON-tagged block) and in `user_learning_profile.recurring_topics`. This keeps scope focused on emotional analysis, not file hosting.

## Output per input
Every attachment produces (and is shown in UI + stored):
- `language`, `emotion`, `intensity` (Low/Medium/High), `sentimentScore` (-1..1), `riskScore` (0..100), `strategy`, plus modality-specific `visualCues` or `speakingPatterns`.

## Files
- **New**: `supabase/functions/ingest-attachment/index.ts`
- **New**: `src/components/AttachmentComposer.tsx`, `src/components/AttachmentChip.tsx`
- **Edit**: `supabase/functions/chat/index.ts` (accept attachments, merge into prompt + emotion pipeline)
- **Edit**: `src/pages/Index.tsx` (wire composer + render attachment chips)
- **Edit**: `src/components/MessageBubble.tsx` (render attachment metadata if present)

No DB migration needed — attachment analysis lives inside existing `messages.content` as a structured prefix the UI parses out.
