// EmoSense — Evolution Detector
// Scans recent metrics + reply analytics and drafts new pending
// evolution_recommendations. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Aggregate last 14d — same shape as admin-suggestions
    const since = new Date(Date.now() - 14 * 86400_000).toISOString();

    const [{ data: overview }, { data: analytics }, { data: moods }, { data: obs }, { data: existingPending }] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.from("reply_analytics").select("emotion, solution_mode, question_count, repetition_score, language, reply_length, created_at").gte("created_at", since).limit(2000),
      supabase.from("mood_logs").select("emotion, risk_level, sentiment_score, created_at").gte("created_at", since).limit(2000),
      supabase.from("evolution_observations").select("*").gte("bucket_start", since).order("bucket_start", { ascending: false }).limit(200),
      supabase.from("evolution_recommendations").select("title").eq("status", "pending"),
    ]);

    const a = analytics || [];
    const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
    const questionAvg = avg(a.map((r: any) => Number(r.question_count) || 0));
    const repetitionAvg = avg(a.map((r: any) => Number(r.repetition_score) || 0));
    const solutionPct = a.length ? a.filter((r: any) => r.solution_mode).length / a.length : 0;
    const highRepetition = a.filter((r: any) => Number(r.repetition_score) >= 0.5).length;

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
        total_replies_sampled: a.length,
      },
      mood: { risk_distribution: riskDist, negative_sentiment_ratio: Number(negRatio.toFixed(2)), total_mood_logs: m.length },
      hourly_observations_sampled: (obs || []).length,
      existing_pending_titles: (existingPending || []).map((r: any) => r.title),
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are the EmoSense Evolution Engine — an autonomous product improvement detector. From anonymized aggregate metrics, produce 3–6 NEW, engineering-actionable recommendations that do NOT duplicate the "existing_pending_titles" list.

Every recommendation MUST be safe, additive, and never touch the core chat protocol without an explicit safety guard. Focus on: safety, reply quality, personalization, engagement, observability, UX.

Reply ONLY via the "propose" tool.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Metrics:\n\n" + JSON.stringify(metricsSummary, null, 2) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "propose",
            description: "Return prioritized improvement recommendations.",
            parameters: {
              type: "object",
              properties: {
                health_summary: { type: "string" },
                top_focus: { type: "string" },
                recommendations: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      description: { type: "string" },
                      problem: { type: "string" },
                      proposed_solution: { type: "string" },
                      benefits: { type: "string" },
                      implementation_plan: { type: "string", description: "Short markdown plan (3–6 bullets)." },
                      area: { type: "string", enum: ["safety","reply_quality","personalization","engagement","admin","ux"] },
                      priority: { type: "string", enum: ["critical","high","medium","low"] },
                      difficulty: { type: "string", enum: ["small","medium","large"] },
                      risk_level: { type: "string", enum: ["low","medium","high"] },
                      time_estimate: { type: "string" },
                      dependencies: { type: "array", items: { type: "string" } },
                    },
                    required: ["title","description","problem","proposed_solution","benefits","implementation_plan","area","priority","difficulty","risk_level","time_estimate","dependencies"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["health_summary","top_focus","recommendations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "propose" } },
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
    if (!args) throw new Error("No structured recommendations");

    // Insert new pending recommendations
    const existingTitles = new Set((existingPending || []).map((r: any) => r.title.toLowerCase()));
    const rows = (args.recommendations || [])
      .filter((r: any) => !existingTitles.has(String(r.title).toLowerCase()))
      .map((r: any) => ({
        title: r.title,
        description: r.description,
        problem: r.problem,
        proposed_solution: r.proposed_solution,
        benefits: r.benefits,
        implementation_plan: r.implementation_plan,
        category: r.area,
        area: r.area,
        priority: r.priority,
        difficulty: r.difficulty,
        risk_level: r.risk_level,
        time_estimate: r.time_estimate,
        dependencies: r.dependencies || [],
        source: "detector",
        status: "pending",
        metrics_snapshot: metricsSummary,
      }));

    let inserted: any[] = [];
    if (rows.length) {
      const { data: ins, error } = await supabase.from("evolution_recommendations").insert(rows).select();
      if (error) throw error;
      inserted = ins || [];
    }

    return new Response(JSON.stringify({
      health_summary: args.health_summary,
      top_focus: args.top_focus,
      inserted_count: inserted.length,
      inserted,
      metrics: metricsSummary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("evolution-detect error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
