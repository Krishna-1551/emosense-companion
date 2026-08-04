import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "emosense_voice_enabled";
const SAMPLE_RATE = 24000;

let ctx: AudioContext | null = null;
const getCtx = () => {
  if (!ctx) ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
  return ctx;
};

type SpeakOptions = { slow?: boolean; signal?: AbortSignal };

const b64ToBytes = (b64: string) => {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

/**
 * Streams TTS audio from the `speak` edge function and plays it progressively.
 * Resolves once the whole utterance has been scheduled and played out.
 */
export async function speakText(text: string, opts: SpeakOptions = {}): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Not signed in");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speak`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ text, slow: opts.slow ?? false }),
    signal: opts.signal,
  });

  if (!res.ok || !res.body) {
    let message = `Voice failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }

  const audio = getCtx();
  if (audio.state === "suspended") await audio.resume().catch(() => {});

  let playhead = 0;
  let pending = new Uint8Array(0);
  const sources: AudioBufferSourceNode[] = [];

  const schedule = (incoming: Uint8Array) => {
    const merged = new Uint8Array(pending.length + incoming.length);
    merged.set(pending);
    merged.set(incoming, pending.length);
    const usable = merged.length - (merged.length % 2);
    pending = merged.slice(usable);
    if (usable === 0) return;
    const samples = new Int16Array(merged.buffer, 0, usable / 2);
    const floats = Float32Array.from(samples, s => s / 32768);
    const buffer = audio.createBuffer(1, floats.length, SAMPLE_RATE);
    buffer.copyToChannel(floats, 0);
    const src = audio.createBufferSource();
    src.buffer = buffer;
    src.connect(audio.destination);
    playhead = playhead === 0 ? audio.currentTime + 0.08 : Math.max(playhead, audio.currentTime);
    src.start(playhead);
    playhead += buffer.duration;
    sources.push(src);
  };

  const stopAll = () => { for (const s of sources) { try { s.stop(); } catch { /* noop */ } } };
  opts.signal?.addEventListener("abort", stopAll, { once: true });

  // Minimal SSE reader — events are `data: {json}` lines separated by blank lines.
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (opts.signal?.aborted) break;
      buf += value;
      const parts = buf.split("\n\n");
      buf = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payloadText = line.slice(5).trim();
          if (!payloadText || payloadText === "[DONE]") continue;
          let payload: { type?: string; audio?: string };
          try { payload = JSON.parse(payloadText); } catch { continue; }
          if (payload.type === "speech.audio.delta" && payload.audio) schedule(b64ToBytes(payload.audio));
        }
      }
    }
  } finally {
    try { reader.cancel(); } catch { /* noop */ }
  }

  if (opts.signal?.aborted) { stopAll(); return; }

  // Wait until the scheduled audio has finished playing.
  const remaining = Math.max(0, playhead - audio.currentTime);
  await new Promise<void>(resolve => {
    const t = setTimeout(resolve, remaining * 1000 + 120);
    opts.signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

export function useSpeech() {
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "1"; } catch { return false; }
  });
  const [speaking, setSpeaking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, options?: { slow?: boolean }) => {
    if (!text?.trim()) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setSpeaking(true);
    try {
      await speakText(text, { slow: options?.slow, signal: controller.signal });
    } catch (e) {
      if (!controller.signal.aborted) throw e;
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setSpeaking(false);
    }
  }, []);

  const toggle = useCallback(() => {
    setEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* noop */ }
      if (!next) stop();
      return next;
    });
  }, [stop]);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  return { enabled, toggle, speaking, speak, stop };
}
