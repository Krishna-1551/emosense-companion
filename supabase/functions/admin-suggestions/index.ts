// EmoSense — Admin Suggestions engine
// Aggregates recent analytics and asks Lovable AI to produce prioritized,
// actionable recommendations to improve the product / prompt / safety.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    // Admin check
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---- Gather aggregates (last 14 days) ----
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();

    const [{ data: overview }, { data: analytics }, { data: moods }, { data: highCases }] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.from("reply_analytics").select("emotion, solution_mode, question_count, repetition_score, language, reply_length, created_at").gte("created_at", since).limit(2000),
      supabase.from("mood_logs").select("emotion, risk_level, sentiment_score, created_at").gte("created_at", since).limit(2000),
      supabase.from("messages").select("content, emotion, risk_level, created_at").eq("risk_level", "high").gte("created_at", since).limit(50),
    ]);

    // Reply-quality metrics
    const a = analytics || [];
    const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
    const questionAvg = avg(a.map((r: any) => Number(r.question_count) || 0));
    const repetitionAvg = avg(a.map((r: any) => Number(r.repetition_score) || 0));
    const solutionPct = a.length ? a.filter((r: any) => r.solution_mode).length / a.length : 0;
    const langDist: Record<string, number> = {};
    for (const r of a as any[]) langDist[r.language || "unknown"] = (langDist[r.language || "unknown"] || 0) + 1;
    const emotionDist: Record<string, number> = {};
    for (const r of a as any[]) emotionDist[r.emotion || "unknown"] = (emotionDist[r.emotion || "unknown"] || 0) + 1;
    const highRepetition = a.filter((r: any) => Number(r.repetition_score) >= 0.5).length;
    const zeroQuestionReplies = a.filter((r: any) => Number(r.question_count) === 0).length;
    const multiQuestionReplies = a.filter((r: any) => Number(r.question_count) >= 2).length;

    // Mood metrics
    const m = moods || [];
    const riskDist = { low: 0, moderate: 0, high: 0 } as Record<string, number>;
    for (const r of m as any[]) if (riskDist[r.risk_level] !== undefined) riskDist[r.risk_level]++;
    const negRatio = m.length ? (m as any[]).filter(r => Number(r.sentiment_score) < -0.2).length / m.length : 0;

    const metricsSummary = {
      window_days: 14,
      overview: overview?.[0] ?? {},
      reply_quality: {
        avg_questions_per_reply: Number(questionAvg.toFixed(2)),
        avg_repetition_score: Number(repetitionAvg.toFixed(3)),
        solution_mode_pct: Number((solutionPct * 100).toFixed(1)),
        high_repetition_replies: highRepetition,
        zero_question_replies: zeroQuestionReplies,
        multi_question_replies: multiQuestionReplies,
        total_replies_sampled: a.length,
      },
      language_distribution: langDist,
      emotion_distribution: emotionDist,
      mood: {
        risk_distribution: riskDist,
        negative_sentiment_ratio: Number(negRatio.toFixed(2)),
        total_mood_logs: m.length,
      },
      high_risk_case_count: (highCases || []).length,
      high_risk_excerpts: (highCases || []).slice(0, 8).map((c: any) => String(c.content || "").slice(0, 160)),
    };

    // ---- Call Lovable AI for recommendations ----
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are a senior product + clinical-safety reviewer for EmoSense AI, an emotional-support chatbot. You receive anonymized aggregate metrics and produce a short, prioritized list of concrete, engineering-actionable improvement suggestions.

Focus areas (in order): (1) user safety & crisis handling, (2) response quality (empathy, non-repetition, question discipline, solution balance), (3) personalization & psychometric depth, (4) engagement & retention, (5) admin/observability tooling, (6) UX polish.

Rules:
- Every suggestion must be specific and actionable ("Lower avg_questions_per_reply from 1.4 → 1.0 by tightening question-suppression rule after 1 prior question"), never vague ("improve empathy").
- Cite the metric that triggered it when possible.
- Mark priority: "critical" (safety), "high", "medium", "low".
- Mark effort: "small" (prompt tweak / config), "medium" (edge function change), "large" (schema / new feature).
- 5 to 8 suggestions total. No filler.
- Also produce a one-line "health_summary" verdict and a "top_focus" string.
Reply strictly via the "suggest" tool.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Here are the last 14 days of anonymized metrics:\n\n" + JSON.stringify(metricsSummary, null, 2) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "suggest",
            description: "Return prioritized improvement suggestions.",
            parameters: {
              type: "object",
              properties: {
                health_summary: { type: "string", description: "One-line verdict on the app's current state." },
                top_focus: { type: "string", description: "The single most important area to work on next." },
                suggestions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      detail: { type: "string", description: "Concrete change to make and why (cite a metric)." },
                      area: { type: "string", enum: ["safety","reply_quality","personalization","engagement","admin","ux"] },
                      priority: { type: "string", enum: ["critical","high","medium","low"] },
                      effort: { type: "string", enum: ["small","medium","large"] },
                    },
                    required: ["title","detail","area","priority","effort"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["health_summary","top_focus","suggestions"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "suggest" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit — try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("AI gateway failed");
    }
    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = call ? JSON.parse(call.function.arguments) : null;
    if (!args) throw new Error("No structured suggestions");

    return new Response(JSON.stringify({
      generated_at: new Date().toISOString(),
      metrics: metricsSummary,
      ...args,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("admin-suggestions error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
