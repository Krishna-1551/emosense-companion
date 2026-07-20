// EmoSense — Evolution Health snapshot
// Computes health + evolution score from recent metrics. Admin-only.
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

    const since = new Date(Date.now() - 7 * 86400_000).toISOString();
    const [{ data: overview }, { data: analytics }, { data: recs }, { data: decisions }, { data: obs }] = await Promise.all([
      supabase.rpc("admin_overview"),
      supabase.from("reply_analytics").select("repetition_score, question_count, solution_mode").gte("created_at", since).limit(2000),
      supabase.from("evolution_recommendations").select("status"),
      supabase.from("evolution_decisions").select("new_status, created_at").gte("created_at", since),
      supabase.from("evolution_observations").select("bucket_start, active_users, message_count, avg_repetition, avg_questions, high_risk_count, solution_mode_pct").gte("bucket_start", since).order("bucket_start", { ascending: true }),
    ]);

    const a = analytics || [];
    const avg = (arr: number[]) => arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0;
    const repAvg = avg(a.map((r: any) => Number(r.repetition_score) || 0));
    const qAvg = avg(a.map((r: any) => Number(r.question_count) || 0));

    // Health score (0-100): quality (rep low + questions balanced) 60 + activity 40
    const qualityScore = Math.max(0, Math.round((1 - Math.min(repAvg, 1)) * 40 + (qAvg <= 1.2 ? 20 : Math.max(0, 20 - (qAvg - 1.2) * 10))));
    const activityScore = Math.min(40, Math.round(((overview?.[0]?.active_today ?? 0) / 20) * 40));
    const healthScore = Math.min(100, qualityScore + activityScore);

    // Evolution score: approved recommendations vs total decided
    const totalRecs = (recs || []).length;
    const approved = (recs || []).filter((r: any) => r.status === "approved" || r.status === "implemented").length;
    const implemented = (recs || []).filter((r: any) => r.status === "implemented").length;
    const evolutionScore = totalRecs === 0 ? 0 : Math.round(((approved * 0.6 + implemented * 0.4) / totalRecs) * 100);

    const kpis = {
      avg_repetition: Number(repAvg.toFixed(3)),
      avg_questions: Number(qAvg.toFixed(2)),
      total_users: overview?.[0]?.total_users ?? 0,
      total_messages: overview?.[0]?.total_messages ?? 0,
      active_today: overview?.[0]?.active_today ?? 0,
      high_risk_today: overview?.[0]?.high_risk_today ?? 0,
      recommendations: {
        total: totalRecs,
        pending: (recs || []).filter((r: any) => r.status === "pending").length,
        approved,
        rejected: (recs || []).filter((r: any) => r.status === "rejected").length,
        archived: (recs || []).filter((r: any) => r.status === "archived").length,
        implemented,
      },
      recent_decisions: (decisions || []).length,
    };

    return new Response(JSON.stringify({
      generated_at: new Date().toISOString(),
      health_score: healthScore,
      evolution_score: evolutionScore,
      kpis,
      observations: obs || [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("evolution-health error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
