import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "emosense_voice_enabled";

type SpeakOptions = { slow?: boolean; signal?: AbortSignal };

// One shared <audio> element: created on first use, reused for every utterance.
// Reusing a single element keeps mobile browsers happy with autoplay policies.
let el: HTMLAudioElement | null = null;
const getEl = () => {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
  }
  return el;
};

/** Splits a reply into short speakable segments so the first words start fast. */
function segment(text: string, firstMax = 160, restMax = 420): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?]*\s*/g) ?? [text];
  const out: string[] = [];
  let current = "";
  const limit = () => (out.length === 0 ? firstMax : restMax);
  for (const s of sentences) {
    if (current && (current + s).length > limit()) {
      out.push(current.trim());
      current = "";
    }
    current += s;
  }
  if (current.trim()) out.push(current.trim());
  return out.filter(Boolean);
}

/** Requests one audio segment as a blob. */
async function fetchSegment(text: string, slow: boolean, signal?: AbortSignal): Promise<Blob> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("Please sign in to use voice replies.");

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/speak`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    },
    body: JSON.stringify({ text, slow }),
    signal,
  });

  if (!res.ok) {
    let message = `Voice failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch { /* keep default */ }
    throw new Error(message);
  }

  const blob = await res.blob();
  if (!blob.size) throw new Error("Voice returned no audio.");
  return blob;
}

function playBlob(blob: Blob, signal?: AbortSignal): Promise<void> {
  const objectUrl = URL.createObjectURL(blob);
  const audio = getEl();
  audio.pause();
  audio.src = objectUrl;
  audio.currentTime = 0;

  return new Promise<void>((resolve, reject) => {
    const done = () => { detach(); URL.revokeObjectURL(objectUrl); resolve(); };
    const fail = () => { detach(); URL.revokeObjectURL(objectUrl); reject(new Error("Audio playback was blocked by the browser.")); };
    const onAbort = () => { audio.pause(); done(); };
    const detach = () => {
      audio.removeEventListener("ended", done);
      audio.removeEventListener("error", fail);
      signal?.removeEventListener("abort", onAbort);
    };
    audio.addEventListener("ended", done);
    audio.addEventListener("error", fail);
    signal?.addEventListener("abort", onAbort, { once: true });

    audio.play().catch(err => {
      detach();
      URL.revokeObjectURL(objectUrl);
      reject(err instanceof Error ? err : new Error("Audio playback failed."));
    });
  });
}

/**
 * Speaks a reply: the first short segment is fetched and played immediately while
 * the remaining segments are synthesized in the background, so speech starts fast.
 */
export async function speakText(text: string, opts: SpeakOptions = {}): Promise<void> {
  const slow = opts.slow ?? false;
  const parts = segment(text);
  if (!parts.length) return;

  let next: Promise<Blob> | null = fetchSegment(parts[0], slow, opts.signal);

  for (let i = 0; i < parts.length; i++) {
    const current = next!;
    // Start synthesizing the following segment while this one plays.
    next = i + 1 < parts.length ? fetchSegment(parts[i + 1], slow, opts.signal) : null;
    const blob = await current;
    if (opts.signal?.aborted) return;
    await playBlob(blob, opts.signal);
    if (opts.signal?.aborted) return;
  }
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
    try { el?.pause(); } catch { /* noop */ }
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (text: string, options?: { slow?: boolean }) => {
    if (!text?.trim()) return;
    abortRef.current?.abort();
    try { el?.pause(); } catch { /* noop */ }
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
