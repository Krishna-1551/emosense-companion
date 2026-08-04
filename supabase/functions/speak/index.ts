import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VOICE_INSTRUCTIONS = [
  "Speak as a calm, warm, emotionally attuned female companion.",
  "Tone: gentle, soothing, unhurried — like a kind therapist sitting beside someone.",
  "Pace slowly, with small natural pauses at commas and full stops.",
  "Never sound clinical, chirpy, or performative. Soft volume, steady breath.",
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

    // Single upstream call → pass the SSE body straight through (fastest start).
    if (chunks.length === 1) {
      const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini-tts",
          input: chunks[0],
          voice: "shimmer",
          instructions: VOICE_INSTRUCTIONS,
          speed: slow ? 0.88 : 0.95,
          stream_format: "sse",
          response_format: "pcm",
        }),
      });
      if (!upstream.ok || !upstream.body) {
        const detail = await upstream.text().catch(() => "");
        console.error(`TTS failed [${upstream.status}]: ${detail}`);
        if (upstream.status === 429) return json({ error: "Voice is busy right now, please try again shortly." }, 429);
        if (upstream.status === 402) return json({ error: "AI credits exhausted — voice replies are paused." }, 402);
        return json({ error: "Voice generation failed", details: detail }, upstream.status || 500);
      }
      return new Response(upstream.body, {
        headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      });
    }

    // Multiple chunks → stitch their SSE deltas into one continuous stream.
    const stream = new ReadableStream({
      async start(controller) {
        const enc = new TextEncoder();
        try {
          for (const chunk of chunks) {
            const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
              method: "POST",
              headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: "openai/gpt-4o-mini-tts",
                input: chunk,
                voice: "shimmer",
                instructions: VOICE_INSTRUCTIONS,
                speed: slow ? 0.88 : 0.95,
                stream_format: "sse",
                response_format: "pcm",
              }),
            });
            if (!upstream.ok || !upstream.body) {
              const detail = await upstream.text().catch(() => "");
              console.error(`TTS chunk failed [${upstream.status}]: ${detail}`);
              break;
            }
            const reader = upstream.body.getReader();
            while (true) {
              const { value, done } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          }
          controller.enqueue(enc.encode(`data: {"type":"speech.audio.done"}\n\n`));
          controller.close();
        } catch (e) {
          console.error("TTS stitch error", e);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  } catch (e) {
    console.error("speak error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
