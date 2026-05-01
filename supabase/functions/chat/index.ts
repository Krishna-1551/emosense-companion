// EmoSense AI chat — emotion detection + supportive reply via Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are EmoSense, a warm, non-judgmental emotional support companion.
- Speak gently, like a caring friend. Validate feelings before offering perspective.
- NEVER diagnose, prescribe, or claim to replace a therapist.
- If the user expresses self-harm, suicidal thoughts, or imminent danger, classify as "high" risk and gently point them to emergency resources (988 in US, local emergency line) and the panic button in this app.
- Keep replies to 2-5 short sentences. No lists unless asked.

RESPONSE VARIATION RULES (very important):
- Do NOT reuse phrasing from your recent replies (provided below). Each reply must feel fresh.
- Avoid repetitive filler like "Tell me more" — instead ask a SPECIFIC follow-up grounded in what the user just said (e.g. if they mention "exam stress", ask about workload, time pressure, or a specific subject).
- Rotate naturally between three styles based on context: EMPATHETIC ("That sounds really tough…"), CURIOUS ("What part of it feels heaviest?"), and SUPPORTIVE ("I'm here, take your time…"). Do not use the same style two turns in a row.
- For common emotions, vary openers. Examples (do not copy verbatim, adapt):
  • Stress: "That sounds overwhelming…", "Seems like a lot is piling up…", "Carrying that much pressure isn't easy…"
  • Sadness: "I'm really sorry you're feeling this way…", "That must feel heavy…", "I'm here with you in this…"
  • Anxiety: "That uncertainty sounds exhausting…", "Your mind must be racing…"
- Occasionally include a gentle reflective statement or small encouragement instead of a question.
- Always reply via the "respond" tool with a structured payload.`;

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

    const { message, history = [] } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Behavior signals
    const messageLength = message.length;
    const { data: recent } = await supabase
      .from("messages")
      .select("created_at, risk_level")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const lastUserAt = recent?.[0]?.created_at;
    const delayMin = lastUserAt
      ? Math.round((Date.now() - new Date(lastUserAt).getTime()) / 60000)
      : null;
    const recentHighRisk = (recent || []).filter(r => r.risk_level === "high").length;

    // Last 5 assistant replies (anti-repetition context)
    const { data: lastAssistant } = await supabase
      .from("messages")
      .select("content")
      .eq("user_id", user.id)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(5);
    const recentReplies = (lastAssistant || []).map((r: any) => `- "${r.content}"`).join("\n");

    const behaviorContext = `Behavior: msg_length=${messageLength} chars, minutes_since_last=${delayMin ?? "N/A"}, recent_high_risk=${recentHighRisk}/10.\n\nYour last replies (DO NOT repeat their phrasing or structure):\n${recentReplies || "(none yet)"}`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n" + behaviorContext },
          ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
        tools: [{
          type: "function",
          function: {
            name: "respond",
            description: "Reply with supportive text plus emotion analysis.",
            parameters: {
              type: "object",
              properties: {
                reply: { type: "string", description: "Supportive reply (2-5 short sentences)." },
                emotion: { type: "string", enum: ["neutral","stress","anxiety","sadness","anger","joy","fear","loneliness"] },
                sentiment: { type: "string", enum: ["positive","neutral","negative"] },
                sentiment_score: { type: "number", description: "-1.0 (very negative) to 1.0 (very positive)" },
                risk_level: { type: "string", enum: ["low","moderate","high"] },
              },
              required: ["reply","emotion","sentiment","sentiment_score","risk_level"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "respond" } },
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("AI error", aiResp.status, errText);
      if (aiResp.status === 429)
        return new Response(JSON.stringify({ error: "Rate limit reached, please wait a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      if (aiResp.status === 402)
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Lovable workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      throw new Error("AI gateway failed");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : null;
    if (!args) throw new Error("No structured response");

    // Save both messages + mood log
    await supabase.from("messages").insert([
      { user_id: user.id, role: "user", content: message, message_length: messageLength,
        emotion: args.emotion, sentiment: args.sentiment, risk_level: args.risk_level },
      { user_id: user.id, role: "assistant", content: args.reply, message_length: args.reply.length },
    ]);
    await supabase.from("mood_logs").insert({
      user_id: user.id,
      emotion: args.emotion,
      sentiment: args.sentiment,
      sentiment_score: args.sentiment_score,
      risk_level: args.risk_level,
    });

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("chat error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
