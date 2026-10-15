import { useCallback, useEffect, useRef, useState } from "react";

/** Browser-only voice helpers (Web Speech API). No audio leaves the device via our servers. */

export type VoiceLang = "en-IN" | "hi-IN";

const cleanForSpeech = (raw: string) =>
  raw
    .replace(/\n*\[\[emosense-attachments:[\s\S]*?\]\]\s*$/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[*_`#>]/g, "")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/** Split into sentence-sized utterances; Chrome silently cuts very long utterances. */
export function splitUtterances(text: string, max = 200): string[] {
  const sentences = text.match(/[^.!?।\n]+[.!?।]*\s*/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && (cur + s).length > max) { out.push(cur.trim()); cur = ""; }
    if (s.length > max) {
      const words = s.split(/\s+/);
      for (const w of words) {
        if ((cur + " " + w).length > max) { if (cur.trim()) out.push(cur.trim()); cur = ""; }
        cur += (cur ? " " : "") + w;
      }
      continue;
    }
    cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}

/** Hindi detection: Devanagari script means Hindi voice, otherwise keep user's choice. */
export const detectLang = (text: string, fallback: VoiceLang): VoiceLang =>
  /[\u0900-\u097F]/.test(text) ? "hi-IN" : fallback;

export function useBrowserTTS() {
  const supported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const runRef = useRef(0);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const stop = useCallback(() => {
    runRef.current++;
    if (supported) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (raw: string, opts: { lang: VoiceLang; voiceURI?: string; slow?: boolean }) =>
      new Promise<void>((resolve, reject) => {
        if (!supported) return reject(new Error("Your browser can't read replies aloud."));
        const text = cleanForSpeech(raw);
        if (!text) return resolve();
        window.speechSynthesis.cancel();
        const run = ++runRef.current;
        const lang = detectLang(text, opts.lang);
        const all = window.speechSynthesis.getVoices();
        const voice =
          all.find(v => v.voiceURI === opts.voiceURI && v.lang.startsWith(lang.slice(0, 2))) ??
          all.find(v => v.lang === lang) ??
          all.find(v => v.lang.startsWith(lang.slice(0, 2))) ??
          null;
        const parts = splitUtterances(text);
        let i = 0;
        setSpeaking(true);
        const next = () => {
          if (run !== runRef.current) return resolve();
          if (i >= parts.length) { setSpeaking(false); return resolve(); }
          const u = new SpeechSynthesisUtterance(parts[i++]);
          u.lang = voice?.lang ?? lang;
          if (voice) u.voice = voice;
          u.rate = opts.slow ? 0.85 : 0.95;
          u.pitch = 1;
          u.onend = next;
          u.onerror = (e) => {
            if (run !== runRef.current || e.error === "interrupted" || e.error === "canceled") return resolve();
            setSpeaking(false);
            reject(new Error(e.error === "not-allowed" ? "Tap play to allow audio in this browser." : "Voice playback failed."));
          };
          window.speechSynthesis.speak(u);
        };
        next();
      }),
    [supported],
  );

  return { supported, voices, speaking, speak, stop };
}

type RecognitionCtor = new () => any;
const getRecognition = (): RecognitionCtor | null =>
  typeof window === "undefined"
    ? null
    : ((window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null);

export function useSpeechInput(onFinal: (text: string) => void) {
  const Ctor = getRecognition();
  const supported = !!Ctor;
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const cancel = useCallback(() => {
    const r = recRef.current;
    recRef.current = null;
    try { r?.abort(); } catch { /* noop */ }
    setListening(false);
    setInterim("");
  }, []);

  /** Only ever called from an explicit user click. */
  const start = useCallback((lang: VoiceLang) => {
    if (!Ctor) { setError("Voice input isn't supported in this browser. You can keep typing."); return; }
    if (recRef.current) return; // prevent double start
    setError(null);
    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = "";
    rec.onresult = (e: any) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t; else interimText += t;
      }
      setInterim(interimText);
    };
    rec.onerror = (e: any) => {
      const map: Record<string, string> = {
        "not-allowed": "Microphone permission was denied. You can allow it in your browser settings, or keep typing.",
        "service-not-allowed": "Microphone permission was denied. You can keep typing.",
        "no-speech": "I didn't catch anything. Try again when you're ready.",
        "audio-capture": "No microphone was found.",
        network: "Voice input needs an internet connection in this browser.",
        aborted: "",
      };
      const msg = map[e.error] ?? "Voice input stopped unexpectedly.";
      if (msg) setError(msg);
    };
    rec.onend = () => {
      const wasActive = recRef.current === rec;
      recRef.current = null;
      setListening(false);
      setInterim("");
      if (!wasActive) return; // cancelled
      const text = finalText.trim();
      if (text) onFinalRef.current(text);
    };
    recRef.current = rec;
    try { rec.start(); setListening(true); } catch { recRef.current = null; setError("Couldn't start the microphone."); }
  }, [Ctor]);

  /** Finish listening and keep what was heard. */
  const finish = useCallback(() => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  useEffect(() => () => { try { recRef.current?.abort(); } catch { /* noop */ } }, []);

  return { supported, listening, interim, error, clearError: () => setError(null), start, finish, cancel };
}
