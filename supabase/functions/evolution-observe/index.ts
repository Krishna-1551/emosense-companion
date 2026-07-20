// EmoSense — Evolution Observer
// Aggregates the last hour of activity into evolution_observations. Read-only
// against production tables. Callable by admins or via scheduled invocation.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Service-role client for aggregation (read-only usage)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Optional: if a user token is present require admin unless it's a scheduled call
    const auth = req.headers.get("Authorization");
    if (auth && !auth.includes("service_role")) {
      const u = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: auth } },
      });
      const { data: { user } } = await u.auth.getUser();
      if (user) {
        const { data: isAdmin } = await u.rpc("has_role", { _user_id: user.id, _role: "admin" });
        if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Bucket = truncated to hour (previous hour)
    const now = new Date();
    const bucketStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() - 1, 0, 0));
    const bucketEnd = new Date(bucketStart.getTime() + 3600_000);

    const isoStart = bucketStart.toISOString();
    const isoEnd = bucketEnd.toISOString();

    const [{ data: msgs }, { data: analytics }, { data: risky }] = await Promise.all([
      admin.from("messages").select("id, user_id, role, emotion, risk_level, created_at").gte("created_at", isoStart).lt("created_at", isoEnd),
      admin.from("reply_analytics").select("emotion, solution_mode, question_count, repetition_score, language").gte("created_at", isoStart).lt("created_at", isoEnd),
      admin.from("messages").select("id").eq("risk_level", "high").gte("created_at", isoStart).lt("created_at", isoEnd),
    ]);

    const m = msgs || [];
    const a = analytics || [];
    const userSet = new Set((m as any[]).map(r => r.user_id));
    const aiReplies = (m as any[]).filter(r => r.role === "assistant").length;
    const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
    const repAvg = avg((a as any[]).map(r => Number(r.repetition_score) || 0));
    const qAvg = avg((a as any[]).map(r => Number(r.question_count) || 0));
    const solPct = a.length ? (a as any[]).filter(r => r.solution_mode).length / a.length * 100 : 0;

    const emotionDist: Record<string, number> = {};
    const langDist: Record<string, number> = {};
    for (const r of a as any[]) {
      emotionDist[r.emotion || "unknown"] = (emotionDist[r.emotion || "unknown"] || 0) + 1;
      langDist[r.language || "unknown"] = (langDist[r.language || "unknown"] || 0) + 1;
    }

    const row = {
      bucket_start: isoStart,
      active_users: userSet.size,
      message_count: m.length,
      ai_reply_count: aiReplies,
      avg_repetition: Number(repAvg.toFixed(4)),
      avg_questions: Number(qAvg.toFixed(3)),
      solution_mode_pct: Number(solPct.toFixed(2)),
      high_risk_count: (risky || []).length,
      emotion_distribution: emotionDist,
      language_distribution: langDist,
    };

    const { error } = await admin.from("evolution_observations").upsert(row, { onConflict: "bucket_start" });
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true, observation: row }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("evolution-observe error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
