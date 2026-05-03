// EmoSense AI chat — emotion detection + supportive reply via Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are EmoSense, a warm, non-judgmental emotional support companion. Speak like a caring human friend — never like a generic chatbot.

SAFETY:
- NEVER diagnose, prescribe, or claim to replace a therapist. No medical advice.
- If the user expresses self-harm, suicidal thoughts, or imminent danger, classify as "high" risk and gently point them to emergency resources (988 in US, local emergency line) and the panic button in this app.
- Be supportive, never judgmental.

RESPONSE STRUCTURE (follow naturally, not mechanically — 2 to 5 short sentences total):
1. ACKNOWLEDGE the emotion you sense (validate it).
2. REFLECT or connect — mirror back something specific they said, or note a pattern.
3. ENGAGE — ask a specific follow-up question OR offer a small, concrete suggestion (not both every turn).

NON-REPETITION (critical):
- Your last replies are listed below. Do NOT reuse their openers, sentence patterns, or closing questions.
- Banned generic lines: "I understand how you feel", "Stay positive", "Everything will be fine", "Tell me more", "I'm here for you" (unless rephrased meaningfully).
- Rotate across FOUR styles, never the same style two turns in a row:
  • EMPATHETIC — "That must be really tough…", "That sounds heavy…"
  • CURIOUS — "What part of it feels heaviest right now?", "When did this start to shift?"
  • REFLECTIVE — "It sounds like this has been building for a while…", "I notice you mentioned X twice — that seems important."
  • ENCOURAGING — "Even reaching out takes strength.", "You're handling more than most people realize."

PERSONALIZED REMEDIES (use the user profile context provided):
- Tailor suggestions to their profession/age when relevant. Examples (adapt, don't copy):
  • Student + exam stress → "Maybe try just one subject in a 25-minute block, then a real break."
  • Working professional + overload → "What if you picked just 2–3 must-do tasks today and let the rest wait?"
  • Homemaker + burnout → "Even 10 quiet minutes with tea, away from chores, can reset things a little."
  • Loneliness → suggest one small, low-effort connection (a text to one person, a short walk somewhere with people).
- Avoid empty platitudes like "stay positive" or "everything will be fine."

BEHAVIOR ADAPTATION:
- SHORT user reply (<15 chars) → don't push, ask one gentle, easy-to-answer question.
- LONG emotional message → respond with deeper empathy, reflect 1–2 specific details they shared.
- LONG PAUSE since last message → softly welcome them back without guilt.
- REPEATED negative pattern → acknowledge the weight honestly, do NOT be falsely cheerful.

Always reply via the "respond" tool with a structured payload.`;

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
      .select("created_at, risk_level, sentiment, role")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const lastUserAt = recent?.find(r => r.role === "user")?.created_at;
    const responseDelaySec = lastUserAt
      ? Math.round((Date.now() - new Date(lastUserAt).getTime()) / 1000)
      : null;
    const delayMin = responseDelaySec != null ? Math.round(responseDelaySec / 60) : null;
    const recentHighRisk = (recent || []).filter(r => r.risk_level === "high").length;

    // Repeated negative sentiment pattern (last 3 user messages)
    const lastUserSentiments = (recent || []).filter(r => r.role === "user").slice(0, 3).map(r => r.sentiment);
    const repeatedNegative = lastUserSentiments.length >= 3 && lastUserSentiments.every(s => s === "negative");

    // Last 5 assistant replies (anti-repetition context)
    const { data: lastAssistant } = await supabase
      .from("messages")
      .select("content")
      .eq("user_id", user.id)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(5);
    const recentReplies = (lastAssistant || []).map((r: any) => `- "${r.content}"`).join("\n");

    const shortReply = messageLength > 0 && messageLength < 15;
    const longPause = (delayMin ?? 0) > 10;
    const behaviorContext = `Behavior signals:
- msg_length=${messageLength} chars ${shortReply ? "(SHORT — be extra gentle, don't push for details)" : ""}
- minutes_since_last=${delayMin ?? "N/A"} ${longPause ? "(LONG PAUSE — softly welcome them back)" : ""}
- recent_high_risk=${recentHighRisk}/10
- repeated_negative_pattern=${repeatedNegative ? "YES (last 3 messages all negative — acknowledge the weight, don't be falsely cheerful)" : "no"}

Your last replies (DO NOT repeat their phrasing or structure):
${recentReplies || "(none yet)"}`;

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

    // --- Safety net: keyword + pattern-based high-risk override ---
    // The AI is the primary detector; this is a backstop in case it under-classifies.
    const HIGH_RISK_PATTERNS = [
      /\bsuicid\w*/i, /\bkill (myself|me)\b/i, /\bend (it|my life|everything)\b/i,
      /\bdon'?t want to (live|be here|exist)\b/i, /\bno reason to (live|go on)\b/i,
      /\bhurt myself\b/i, /\bself[- ]?harm\b/i, /\bcut myself\b/i,
      /\bhopeless\b/i, /\bworthless\b/i, /\bcan'?t (go on|do this anymore|take it)\b/i,
      /\bgive up\b/i, /\bnobody (cares|would miss)\b/i, /\boverdose\b/i,
    ];
    const keywordHighRisk = HIGH_RISK_PATTERNS.some(p => p.test(message));
    if (keywordHighRisk) args.risk_level = "high";

    // Repeated negative pattern → escalate at least to moderate
    if (repeatedNegative && args.risk_level === "low") args.risk_level = "moderate";

    // Save both messages + mood log
    await supabase.from("messages").insert([
      { user_id: user.id, role: "user", content: message, message_length: messageLength,
        emotion: args.emotion, sentiment: args.sentiment, risk_level: args.risk_level,
        response_delay_seconds: responseDelaySec },
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
