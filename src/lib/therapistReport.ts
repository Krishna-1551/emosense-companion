import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/emosense-logo.png";

type TimelineRow = {
  created_at: string;
  emotion: string;
  sentiment_score: number | null;
  risk_level: string;
};

const BRAND = { r: 124, g: 58, b: 237 }; // purple-600
const ACCENT = { r: 34, g: 211, b: 238 }; // cyan-400
const MUTED = { r: 120, g: 120, b: 130 };

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(logoUrl);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function classifyTrend(rows: TimelineRow[]): {
  trend: string;
  avg: number;
  volatility: number;
} {
  const scored = rows.filter((r) => r.sentiment_score != null);
  if (scored.length < 2) return { trend: "Insufficient data", avg: 0, volatility: 0 };
  const vals = scored.map((r) => Number(r.sentiment_score));
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const half = Math.floor(vals.length / 2);
  const first = vals.slice(0, half).reduce((a, b) => a + b, 0) / Math.max(1, half);
  const last = vals.slice(half).reduce((a, b) => a + b, 0) / Math.max(1, vals.length - half);
  const delta = last - first;
  const variance = vals.reduce((s, v) => s + (v - avg) ** 2, 0) / vals.length;
  const volatility = Math.sqrt(variance);
  let trend = "Stable";
  if (delta > 0.15) trend = "Improving";
  else if (delta < -0.15) trend = "Declining";
  return { trend, avg, volatility };
}

export async function generateTherapistReport(userId: string, displayName: string) {
  // Fetch data in parallel
  const [profileRes, timelineRes, msgCountsRes, flaggedRes, analyticsRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.rpc("admin_user_timeline", { target: userId, days: 90 }),
    supabase.from("messages").select("id, role, risk_level, created_at", { count: "exact" }).eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabase.from("messages").select("content, emotion, risk_level, created_at").eq("user_id", userId).eq("role", "user").in("risk_level", ["high", "moderate"]).order("created_at", { ascending: false }).limit(6),
    supabase.from("reply_analytics").select("emotion, solution_mode, question_count, repetition_score, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(100),
  ]);

  const profile: any = profileRes.data || {};
  const timeline: TimelineRow[] = (timelineRes.data as any) || [];
  const messages: any[] = (msgCountsRes.data as any) || [];
  const flagged: any[] = (flaggedRes.data as any) || [];
  const analytics: any[] = (analyticsRes.data as any) || [];

  const userMsgs = messages.filter((m) => m.role === "user");
  const highCount = userMsgs.filter((m) => m.risk_level === "high").length;
  const modCount = userMsgs.filter((m) => m.risk_level === "moderate").length;

  const emotionCounts: Record<string, number> = {};
  timeline.forEach((t) => {
    const key = (t.emotion || "unknown").toLowerCase();
    emotionCounts[key] = (emotionCounts[key] || 0) + 1;
  });
  const dominantEmotions = Object.entries(emotionCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const { trend, avg, volatility } = classifyTrend(timeline);

  const solutionModePct = analytics.length
    ? analytics.filter((a) => a.solution_mode).length / analytics.length
    : 0;
  const avgRepetition = analytics.length
    ? analytics.reduce((s, a) => s + Number(a.repetition_score || 0), 0) / analytics.length
    : 0;

  const logo = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ---------- Header band ----------
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(0, 90, W, 3, "F");

  if (logo) {
    try { doc.addImage(logo, "PNG", 32, 20, 52, 52); } catch { /* ignore */ }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("EmoSense AI", 100, 42);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Understand. Support. Empower.", 100, 58);
  doc.setFontSize(9);
  doc.text("Confidential Clinical Summary — For Licensed Therapist Use Only", 100, 74);

  // right meta
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, W - 32, 42, { align: "right" });
  doc.text(`Report ID: ES-${userId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`, W - 32, 58, { align: "right" });
  doc.text(`Window: last 90 days`, W - 32, 74, { align: "right" });

  let y = 120;
  doc.setTextColor(30, 30, 40);

  // ---------- Section: Patient Overview ----------
  section(doc, "Patient Overview", y); y += 22;
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 4, textColor: [40, 40, 50] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130, textColor: [90, 90, 110] } },
    body: [
      ["Display name", displayName || "—"],
      ["Anonymized ID", userId],
      ["Age", profile.age != null ? String(profile.age) : "—"],
      ["Gender", profile.gender || "—"],
      ["Role / Profession", profile.profession || "—"],
      ["Account created", fmt(profile.created_at)],
      ["Profile completed", fmt(profile.profile_completed_at)],
      ["Trusted contact on file", profile.trusted_contact_name || profile.trusted_contact_phone ? "Yes" : "No"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // ---------- Section: Engagement & Risk Snapshot ----------
  section(doc, "Engagement & Risk Snapshot (last ~200 messages)", y); y += 22;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { fontSize: 10, cellPadding: 5 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    head: [["Metric", "Value", "Clinical note"]],
    body: [
      ["User messages", String(userMsgs.length), "Volume of self-expression captured in window"],
      ["High-risk messages", String(highCount), highCount > 0 ? "Warrants clinical attention" : "None in sample"],
      ["Moderate-risk messages", String(modCount), modCount > 3 ? "Recurring distress signals" : "Occasional"],
      ["Sentiment trend", trend, `Avg sentiment ${avg.toFixed(2)} on [-1, +1] scale`],
      ["Emotional volatility", volatility.toFixed(2), volatility > 0.4 ? "Elevated fluctuation" : "Within typical range"],
      ["Solution-seeking rate", pct(solutionModePct), "Fraction of replies where user asked for actionable steps"],
      ["Reply-repetition score", pct(avgRepetition), "Lower is better; used internally for quality QA"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // ---------- Section: Dominant Emotional Themes ----------
  if (y > H - 200) { doc.addPage(); y = 60; }
  section(doc, "Dominant Emotional Themes", y); y += 22;
  if (dominantEmotions.length === 0) {
    doc.setFontSize(10); doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text("No mood entries in the observation window.", 40, y); y += 20;
  } else {
    const total = dominantEmotions.reduce((s, [, c]) => s + c, 0);
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { fontSize: 10, cellPadding: 5 },
      headStyles: { fillColor: [ACCENT.r, ACCENT.g, ACCENT.b], textColor: 20 },
      head: [["Emotion", "Occurrences", "Share"]],
      body: dominantEmotions.map(([e, c]) => [e, String(c), pct(c / total)]),
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // ---------- Section: Recent flagged excerpts ----------
  if (y > H - 200) { doc.addPage(); y = 60; }
  section(doc, "Recent High/Moderate-Risk Excerpts", y); y += 22;
  if (flagged.length === 0) {
    doc.setFontSize(10); doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text("No flagged messages captured in the recent window.", 40, y); y += 20;
  } else {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, overflow: "linebreak" },
      headStyles: { fillColor: [180, 40, 60], textColor: 255 },
      columnStyles: { 0: { cellWidth: 90 }, 1: { cellWidth: 70 }, 2: { cellWidth: 60 } },
      head: [["When", "Emotion", "Risk", "Excerpt (truncated)"]],
      body: flagged.map((f) => [
        fmt(f.created_at),
        f.emotion || "—",
        (f.risk_level || "").toUpperCase(),
        String(f.content || "").slice(0, 220),
      ]),
    });
    y = (doc as any).lastAutoTable.finalY + 18;
  }

  // ---------- Section: Therapist observations ----------
  if (y > H - 220) { doc.addPage(); y = 60; }
  section(doc, "Suggested Clinical Focus Areas", y); y += 22;

  const suggestions: string[] = [];
  if (highCount > 0) suggestions.push("Assess for active safety concerns; corroborate flagged content with direct interview.");
  if (trend === "Declining") suggestions.push("Explore recent stressors driving downward sentiment trajectory.");
  if (volatility > 0.4) suggestions.push("Consider emotion-regulation strategies (DBT skills, grounding).");
  if (solutionModePct > 0.4) suggestions.push("User frequently requests concrete steps — pair validation with structured goal-setting.");
  const anxious = dominantEmotions.find(([e]) => /anx|stress|panic|worried/.test(e));
  if (anxious) suggestions.push("Recurring anxiety themes — evaluate for GAD screening (GAD-7).");
  const sad = dominantEmotions.find(([e]) => /sad|hopeless|lonely|depress|numb/.test(e));
  if (sad) suggestions.push("Persistent low mood — consider depression screening (PHQ-9).");
  if (!profile.trusted_contact_name && !profile.trusted_contact_phone) suggestions.push("No trusted contact on file — collaborate on a safety-network plan.");
  if (suggestions.length === 0) suggestions.push("No acute red flags; continue supportive monitoring and rapport-building.");

  doc.setFontSize(10);
  doc.setTextColor(40, 40, 50);
  suggestions.forEach((s) => {
    const lines = doc.splitTextToSize(`• ${s}`, W - 80);
    if (y + lines.length * 14 > H - 80) { doc.addPage(); y = 60; }
    doc.text(lines, 40, y);
    y += lines.length * 14 + 4;
  });

  // ---------- Footer on every page ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(220);
    doc.line(32, H - 46, W - 32, H - 46);
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(
      "EmoSense AI · Confidential — This report is a computer-generated summary based on user-reported data and does not constitute a clinical diagnosis.",
      W / 2,
      H - 32,
      { align: "center", maxWidth: W - 80 }
    );
    doc.text(`Page ${i} of ${pageCount}`, W - 32, H - 18, { align: "right" });
    doc.text("emosense-companion.lovable.app", 32, H - 18);
  }

  const safeName = (displayName || userId.slice(0, 8)).replace(/[^a-z0-9]+/gi, "_");
  doc.save(`EmoSense_TherapistReport_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function section(doc: jsPDF, title: string, y: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(32, y - 12, 4, 16, "F");
  doc.setTextColor(30, 30, 40);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(title, 44, y);
  doc.setDrawColor(230);
  doc.line(44, y + 4, W - 32, y + 4);
  doc.setFont("helvetica", "normal");
}
