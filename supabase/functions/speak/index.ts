import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VOICE_INSTRUCTIONS = [
  "Voice: a real, warm young woman in her late twenties — a close friend who genuinely cares.",
  "Affect: soothing, tender, emotionally present. Soft volume, relaxed jaw, gentle breathiness.",
  "Delivery: conversational and human, never like reading a script. Let sentences fall naturally,",
  "soften the ends of phrases, take small real breaths and micro-pauses at commas and full stops.",
  "Add subtle natural warmth and slight smile in the voice when the words are kind or hopeful,",
  "and slow down, lower the pitch a little, when the words are heavy or comforting.",
  "Avoid any clinical, chirpy, announcer or customer-support tone. No exaggerated emotion.",
].join(" ");

// Strip markdown, emoji and internal attachment tags before synthesis.
const cleanForSpeech = (raw: string): string =>
  raw
    .replace(/\n*\[\[emosense-attachments:[\s\S]*?\]\]\s*$/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{2B00}-\u{2BFF}]/gu, "")
    .replace(/[ \t]+/g, " ")
    .trim();

// Keep each request comfortably under the model's input cap.
const chunkText = (text: string, maxWords = 350): string[] => {
  const wordCount = (s: string) => (s.match(/\S+/g) ?? []).length;
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  const flush = () => { if (current.trim()) chunks.push(current.trim()); current = ""; };
  for (const s of sentences) {
    if (wordCount(s) > maxWords) {
      flush();
      const words = s.match(/\S+/g) ?? [];
      for (let i = 0; i < words.length; i += maxWords) chunks.push(words.slice(i, i + maxWords).join(" "));
      continue;
    }
    if (current && wordCount(current) + wordCount(s) > maxWords) flush();
    current += s;
  }
  flush();
  return chunks;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // --- auth (verify_jwt is false by default, so validate in code) ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    // --- input ---
    let body: { text?: unknown; slow?: unknown };
    try { body = await req.json(); } catch { return json({ error: "Invalid JSON body" }, 400); }
    if (typeof body.text !== "string" || !body.text.trim()) {
      return json({ error: "text is required" }, 400);
    }
    const cleaned = cleanForSpeech(body.text.slice(0, 6000));
    if (!cleaned) return json({ error: "nothing to speak" }, 400);
    const slow = body.slow === true;

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "Voice is not configured" }, 500);

    const chunks = chunkText(cleaned);
    const buffers: Uint8Array[] = [];

    for (const chunk of chunks) {
      const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: chunk,
          voice: "coral",
          instructions: VOICE_INSTRUCTIONS,
          speed: slow ? 0.9 : 0.97,
          response_format: "mp3",
        }),
      });

      if (!upstream.ok) {
        const detail = await upstream.text().catch(() => "");
        console.error(`TTS failed [${upstream.status}]: ${detail}`);
        if (upstream.status === 429) return json({ error: "Voice is busy right now, please try again shortly." }, 429);
        if (upstream.status === 402) return json({ error: "AI credits exhausted — voice replies are paused." }, 402);
        return json({ error: "Voice generation failed", details: detail.slice(0, 300) }, upstream.status || 500);
      }

      const bytes = new Uint8Array(await upstream.arrayBuffer());
      if (bytes.byteLength === 0) {
        console.error("TTS returned an empty audio body");
        return json({ error: "Voice returned no audio" }, 502);
      }
      buffers.push(bytes);
    }

    const total = buffers.reduce((n, b) => n + b.byteLength, 0);
    const audio = new Uint8Array(total);
    let offset = 0;
    for (const b of buffers) { audio.set(b, offset); offset += b.byteLength; }
    console.log(`TTS ok — ${chunks.length} chunk(s), ${total} bytes`);

    return new Response(audio, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Content-Length": String(total),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("speak error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
