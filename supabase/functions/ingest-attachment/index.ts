// EmoSense — multimodal attachment ingestion
// Accepts image / audio / document, runs OCR/STT/text extraction + emotional analysis
// via the Lovable AI Gateway, and returns a unified analysis object.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Kind = "image" | "audio" | "document";

const ANALYSIS_TOOL = {
  type: "function" as const,
  function: {
    name: "analyze",
    description: "Return extracted content + unified emotional analysis.",
    parameters: {
      type: "object",
      properties: {
        extractedText: { type: "string", description: "Verbatim text extracted via OCR/STT/parser. May be empty." },
        summary: { type: "string", description: "Short 1-3 sentence summary of meaning/key points." },
        language: { type: "string", enum: ["english", "hindi-devanagari", "hindi-roman", "hinglish", "unknown"] },
        emotion: { type: "string", enum: ["neutral", "stress", "anxiety", "sadness", "anger", "joy", "fear", "loneliness"] },
        intensity: { type: "string", enum: ["Low", "Medium", "High"] },
        sentimentScore: { type: "number", description: "-1.0 (very negative) to 1.0 (very positive)" },
        riskScore: { type: "integer", description: "0 to 100, higher = more concerning emotional content" },
        strategy: { type: "string", description: "1 short sentence on how EmoSense should respond." },
        visualCues: { type: "string", description: "Image only: visible emotional cues (facial expression, posture, scene mood). Empty otherwise." },
        speakingPatterns: { type: "string", description: "Audio only: hesitation, urgency, intensity, pace. Empty otherwise." },
      },
      required: ["extractedText", "summary", "language", "emotion", "intensity", "sentimentScore", "riskScore", "strategy"],
      additionalProperties: false,
    },
  },
};

const SYSTEM = `You are EmoSense's multimodal analyzer. For each input (image, voice, or document) you must:
1. Extract content faithfully (OCR for images, transcription for audio, text for docs).
2. Detect language (Hindi Devanagari / Hindi romanized / Hinglish / English).
3. Detect the dominant emotion + intensity (Low/Medium/High).
4. Give a sentiment score from -1 to 1, and a risk score 0-100 (raise sharply for self-harm, hopelessness, abuse, severe distress).
5. Note visible emotional cues (image) OR speaking patterns like hesitation/urgency/intensity (audio) — leave blank for documents.
6. Suggest a one-line response strategy that EmoSense should follow.
Stay accurate, gentle, and respect Hindi/Hinglish nuance.`;

async function callGateway(parts: any[], extraSystem = "") {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM + (extraSystem ? "\n" + extraSystem : "") },
        { role: "user", content: parts },
      ],
      tools: [ANALYSIS_TOOL],
      tool_choice: { type: "function", function: { name: "analyze" } },
    }),
  });
  return resp;
}

function dataUrl(mime: string, base64: string) {
  return `data:${mime};base64,${base64}`;
}

function b64ToText(b64: string): string {
  try {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { kind, filename, mime, base64 } = await req.json() as {
      kind: Kind; filename: string; mime: string; base64: string;
    };
    if (!kind || !base64 || !mime) {
      return new Response(JSON.stringify({ error: "kind, mime, base64 required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Size guard ~10MB base64 ≈ 7.5MB binary
    if (base64.length > 14_000_000) {
      return new Response(JSON.stringify({ error: "File too large (max ~10MB)" }), {
        status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let parts: any[] = [];
    let extraSystem = "";

    if (kind === "image") {
      extraSystem = `MODE: IMAGE. Perform OCR on any visible text, then describe visible emotional cues (faces, body language, scene mood). Fill visualCues. If the image is purely decorative with no emotional signal, set emotion=neutral, intensity=Low.`;
      parts = [
        { type: "text", text: `Analyze this image (${filename || "image"}). OCR all visible text and describe emotional cues.` },
        { type: "image_url", image_url: { url: dataUrl(mime, base64) } },
      ];
    } else if (kind === "audio") {
      extraSystem = `MODE: AUDIO. Transcribe the speech (Hindi, Hinglish, or English) verbatim into extractedText. Detect speaking patterns — hesitation, urgency, emotional intensity, pace — and fill speakingPatterns. Base emotional analysis on the transcript + delivery.`;
      // Gemini supports inline audio via input_audio
      parts = [
        { type: "text", text: `Transcribe and analyze this voice message (${filename || "voice"}).` },
        { type: "input_audio", input_audio: { data: base64, format: (mime.split("/")[1] || "webm").replace("x-", "") } },
      ];
    } else if (kind === "document") {
      // PDFs handled by Gemini directly (file_data). TXT decoded inline. DOCX gets best-effort text strip.
      if (mime === "application/pdf") {
        extraSystem = `MODE: PDF. Extract the meaningful text, summarize the key points in summary, and detect any emotional patterns expressed in the writing. extractedText can be the first ~2000 chars of the text.`;
        parts = [
          { type: "text", text: `Analyze this PDF (${filename || "document.pdf"}).` },
          { type: "file", file: { file_data: dataUrl(mime, base64), filename: filename || "document.pdf" } },
        ];
      } else if (mime === "text/plain" || mime === "text/markdown" || filename?.endsWith(".txt")) {
        const text = b64ToText(base64).slice(0, 20000);
        extraSystem = `MODE: TEXT DOCUMENT. The text content is provided directly below. Summarize and analyze it.`;
        parts = [
          { type: "text", text: `Document: ${filename || "document.txt"}\n\nContent:\n${text}` },
        ];
      } else if (
        mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        filename?.endsWith(".docx")
      ) {
        // Lightweight DOCX text extraction: unzip and pull document.xml text nodes
        try {
          // Use JSZip via esm.sh (Deno compatible)
          const JSZip = (await import("https://esm.sh/jszip@3.10.1")).default;
          const bin = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
          const zip = await JSZip.loadAsync(bin);
          const xml = await zip.file("word/document.xml")?.async("string") ?? "";
          const text = xml
            .replace(/<w:p\b[^>]*>/g, "\n")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim()
            .slice(0, 20000);
          extraSystem = `MODE: DOCX. Extracted text provided below. Summarize and analyze.`;
          parts = [
            { type: "text", text: `Document: ${filename || "document.docx"}\n\nContent:\n${text}` },
          ];
        } catch (e) {
          return new Response(JSON.stringify({ error: "Could not read .docx file" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else if (mime === "application/msword" || filename?.endsWith(".doc")) {
        return new Response(JSON.stringify({
          error: "Legacy .doc files are not supported — please save as .docx or .pdf.",
        }), { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        return new Response(JSON.stringify({ error: `Unsupported document type: ${mime}` }), {
          status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: `Unknown kind: ${kind}` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await callGateway(parts, extraSystem);
    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gateway error", resp.status, errText);
      if (resp.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit reached — please wait a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted — please add funds in your Lovable workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      return new Response(JSON.stringify({ error: "AI analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) throw new Error("No structured analysis returned");
    const analysis = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({
      kind, filename: filename || null, mime, analysis,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("ingest-attachment error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
