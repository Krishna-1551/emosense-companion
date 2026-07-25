// EmoSense — Therapist Report generator
// Produces a clinical, privacy-preserving analysis of a user.
// NEVER returns raw user chat content. AI translates conversation signals
// into clinical terminology, provisional themes, and recommendations.
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
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const { user_id } = await req.json();
    if (!user_id) return json({ error: "user_id required" }, 400);

    // Service role client to read across user data
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const since90 = new Date(Date.now() - 90 * 86400_000).toISOString();

    const [profileRes, messagesRes, analyticsRes, moodsRes] = await Promise.all([
      admin.from("profiles").select("*").eq("id", user_id).maybeSingle(),
      admin.from("messages")
        .select("role, content, emotion, risk_level, sentiment_score, created_at")
        .eq("user_id", user_id).gte("created_at", since90)
        .order("created_at", { ascending: false }).limit(400),
      admin.from("reply_analytics")
        .select("emotion, solution_mode, question_count, repetition_score, created_at")
        .eq("user_id", user_id).gte("created_at", since90).limit(300),
      admin.from("mood_logs")
        .select("emotion, risk_level, sentiment_score, created_at")
        .eq("user_id", user_id).gte("created_at", since90).limit(400),
    ]);

    const profile: any = profileRes.data || {};
    const messages: any[] = (messagesRes.data as any) || [];
    const analytics: any[] = (analyticsRes.data as any) || [];
    const moods: any[] = (moodsRes.data as any) || [];

    const userMsgs = messages.filter((m) => m.role === "user");
    const emotionCounts: Record<string, number> = {};
    const riskCounts = { low: 0, moderate: 0, high: 0 } as Record<string, number>;
    let sentSum = 0, sentN = 0;
    for (const m of userMsgs) {
      const e = String(m.emotion || "unknown").toLowerCase();
      emotionCounts[e] = (emotionCounts[e] || 0) + 1;
      if (riskCounts[m.risk_level] !== undefined) riskCounts[m.risk_level]++;
      if (m.sentiment_score != null) { sentSum += Number(m.sentiment_score); sentN++; }
    }
    const avgSent = sentN ? sentSum / sentN : 0;

    // Sentiment trajectory (halves)
    const sortedAsc = [...userMsgs].reverse().filter((m) => m.sentiment_score != null);
    const half = Math.floor(sortedAsc.length / 2);
    const firstAvg = half ? sortedAsc.slice(0, half).reduce((s, r) => s + Number(r.sentiment_score), 0) / half : 0;
    const lastAvg = (sortedAsc.length - half) ? sortedAsc.slice(half).reduce((s, r) => s + Number(r.sentiment_score), 0) / (sortedAsc.length - half) : 0;
    const trend = lastAvg - firstAvg;

    const solutionSeekPct = analytics.length
      ? analytics.filter((a) => a.solution_mode).length / analytics.length : 0;

    // Behavioural rhythm — active time slots
    const hourBuckets = new Array(24).fill(0);
    for (const m of userMsgs) hourBuckets[new Date(m.created_at).getHours()]++;
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
    const lateNightShare = userMsgs.length
      ? userMsgs.filter((m) => { const h = new Date(m.created_at).getHours(); return h >= 0 && h < 5; }).length / userMsgs.length
      : 0;

    // We send FULL conversation content to the model server-side, but the tool
    // output schema does NOT permit any quoted content. The model is instructed
    // to synthesize into clinical language only.
    const conversationDigest = userMsgs.slice(0, 120).reverse().map((m, i) => ({
      i, t: m.created_at, emotion: m.emotion, risk: m.risk_level,
      sentiment: m.sentiment_score, text: String(m.content || "").slice(0, 400),
    }));

    const metrics = {
      window_days: 90,
      profile: {
        age: profile.age ?? null,
        gender: profile.gender ?? null,
        profession: profile.profession ?? null,
        trusted_contact_on_file: !!(profile.trusted_contact_name || profile.trusted_contact_phone),
        account_age_days: profile.created_at ? Math.round((Date.now() - new Date(profile.created_at).getTime()) / 86400_000) : null,
      },
      engagement: {
        user_messages: userMsgs.length,
        mood_logs: moods.length,
        peak_hour_local_server: peakHour,
        late_night_share_0_5h: Number(lateNightShare.toFixed(2)),
      },
      affect: {
        avg_sentiment: Number(avgSent.toFixed(3)),
        sentiment_shift_first_to_last_half: Number(trend.toFixed(3)),
        emotion_distribution: emotionCounts,
        risk_distribution: riskCounts,
      },
      behaviour: {
        solution_seeking_rate: Number(solutionSeekPct.toFixed(2)),
      },
    };

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = `You are a licensed mental-health clinician producing a written pre-consultation summary for a psychotherapist who will meet this client. You will receive (a) anonymized behavioural metrics and (b) a digest of the client's own words from an AI journaling app.

ABSOLUTE PRIVACY RULES — non-negotiable:
- NEVER quote, paraphrase-with-quotes, or reproduce any user sentence, phrase, or identifying content in your output. Not even short fragments.
- Do NOT include names, places, employers, family names, or specific incidents.
- Translate everything into clinical, generalized terminology (e.g. "reports persistent low mood with anhedonic features", NOT "said he feels sad about his job at X").
- Every "evidence" field must be a clinical descriptor (frequency, pattern, intensity), never a quote.

CLINICAL STANDARDS:
- Use DSM-5-TR / ICD-11-oriented descriptive language. Do NOT diagnose. Use hedged provisional language ("features consistent with", "sub-threshold indicators of", "warrants screening for").
- Ground every provisional theme in observed patterns from the metrics + digest. If evidence is thin, mark strength as "mild" or omit.
- Consider: depressive features, anxiety features (generalized / social / panic), trauma-related indicators, acute-stress / burnout, grief, interpersonal / relational conflict, sleep disturbance, substance-use concerns, disordered eating, obsessional patterns, self-harm & suicidal ideation, psychosis (only if clearly indicated).
- Note protective factors (help-seeking, insight, social support, treatment engagement, hobbies, faith, planning ability).
- Recommend validated screenings only when indicated (PHQ-9, GAD-7, PCL-5, C-SSRS, ISI, AUDIT-C, MDQ, PSS-10, K10, DERS).
- Recommend evidence-based intervention modalities appropriate to the pattern (CBT, DBT skills, ACT, IPT, TF-CBT, behavioural activation, mindfulness-based, motivational interviewing, safety planning, crisis referral).
- Cultural note: many users are in India; consider family / academic / caste / gender-role stressors without stereotyping.
- Include limitations: this is app-derived, non-diagnostic, based on self-report to a chatbot.

Return via the "clinical_summary" tool. Be precise, sober, and non-alarmist. If risk indicators are present, flag them clearly.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content:
            "AGGREGATED METRICS (last 90 days):\n" + JSON.stringify(metrics, null, 2) +
            "\n\nCONVERSATION DIGEST (client's own words, for YOUR analysis only — do NOT quote in output):\n" +
            JSON.stringify(conversationDigest) },
        ],
        tools: [{
          type: "function",
          function: {
            name: "clinical_summary",
            description: "Structured pre-consultation clinical summary. Zero raw quotes.",
            parameters: {
              type: "object",
              properties: {
                clinical_impression: { type: "string", description: "2-4 sentence sober overview in clinical language. No quotes." },
                presenting_concerns: { type: "array", items: { type: "string" }, description: "Short clinical phrases only." },
                provisional_themes: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      theme: { type: "string", description: "e.g. Depressive features, Generalized anxiety features, Acute stress / burnout, Trauma-related indicators, Interpersonal distress, Sleep disturbance, Suicidal ideation." },
                      evidence_strength: { type: "string", enum: ["mild", "moderate", "marked"] },
                      clinical_evidence: { type: "string", description: "Pattern-based descriptor only (frequency, duration, associated features). NO quotes." },
                    },
                    required: ["theme", "evidence_strength", "clinical_evidence"],
                    additionalProperties: false,
                  },
                },
                risk_assessment: {
                  type: "object",
                  properties: {
                    level: { type: "string", enum: ["low", "moderate", "elevated", "high", "acute"] },
                    risk_factors: { type: "array", items: { type: "string" } },
                    protective_factors: { type: "array", items: { type: "string" } },
                    safety_plan_recommended: { type: "boolean" },
                    notes: { type: "string" },
                  },
                  required: ["level", "risk_factors", "protective_factors", "safety_plan_recommended", "notes"],
                  additionalProperties: false,
                },
                cognitive_patterns: { type: "array", items: { type: "string" }, description: "e.g. catastrophizing, rumination, self-blame, black-and-white thinking, avoidance, perfectionism." },
                behavioural_observations: { type: "array", items: { type: "string" }, description: "e.g. late-night activity pattern, help-seeking behaviour, withdrawal signals, solution-seeking orientation." },
                functional_impact: {
                  type: "object",
                  properties: {
                    work_or_academic: { type: "string" },
                    relationships: { type: "string" },
                    self_care_and_sleep: { type: "string" },
                  },
                  required: ["work_or_academic", "relationships", "self_care_and_sleep"],
                  additionalProperties: false,
                },
                recommended_screenings: { type: "array", items: { type: "string" }, description: "Validated instruments only (PHQ-9, GAD-7, PCL-5, C-SSRS, ISI, AUDIT-C, K10, DERS, etc.)." },
                suggested_interventions: { type: "array", items: { type: "string" }, description: "Evidence-based modalities appropriate to the pattern." },
                therapist_focus_areas: { type: "array", items: { type: "string" }, description: "First-session priorities for the clinician." },
                prognosis_note: { type: "string" },
                limitations: { type: "string", description: "State the data source constraints and non-diagnostic nature." },
              },
              required: ["clinical_impression", "presenting_concerns", "provisional_themes", "risk_assessment", "cognitive_patterns", "behavioural_observations", "functional_impact", "recommended_screenings", "suggested_interventions", "therapist_focus_areas", "prognosis_note", "limitations"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "clinical_summary" } },
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI error", resp.status, t);
      if (resp.status === 429) return json({ error: "Rate limit — try again shortly." }, 429);
      if (resp.status === 402) return json({ error: "AI credits exhausted." }, 402);
      throw new Error("AI gateway failed");
    }
    const data = await resp.json();
    const call = data.choices?.[0]?.message?.tool_calls?.[0];
    const summary = call ? JSON.parse(call.function.arguments) : null;
    if (!summary) throw new Error("No structured summary");

    return json({
      generated_at: new Date().toISOString(),
      profile: {
        age: profile.age ?? null,
        gender: profile.gender ?? null,
        profession: profile.profession ?? null,
        trusted_contact_on_file: !!(profile.trusted_contact_name || profile.trusted_contact_phone),
        account_created_at: profile.created_at ?? null,
        profile_completed_at: profile.profile_completed_at ?? null,
      },
      metrics,
      summary,
    });
  } catch (e) {
    console.error("therapist-report error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
