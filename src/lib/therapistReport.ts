import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { supabase } from "@/integrations/supabase/client";
import logoUrl from "@/assets/emosense-logo.png";

const BRAND = { r: 124, g: 58, b: 237 };
const ACCENT = { r: 34, g: 211, b: 238 };
const MUTED = { r: 120, g: 120, b: 130 };
const DANGER = { r: 190, g: 40, b: 60 };

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
  } catch { return null; }
}

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

const RISK_COLOR: Record<string, [number, number, number]> = {
  low: [60, 140, 90],
  moderate: [200, 150, 40],
  elevated: [210, 110, 40],
  high: [190, 60, 60],
  acute: [140, 30, 40],
};

export async function generateTherapistReport(userId: string, displayName: string) {
  const { data, error } = await supabase.functions.invoke("therapist-report", {
    body: { user_id: userId },
  });
  if (error || !data || (data as any).error) {
    throw new Error((data as any)?.error || error?.message || "Failed to generate report");
  }

  const { profile, metrics, summary, generated_at } = data as any;
  const logo = await loadLogoDataUrl();
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();

  // ---------- Header ----------
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(0, 0, W, 90, "F");
  doc.setFillColor(ACCENT.r, ACCENT.g, ACCENT.b);
  doc.rect(0, 90, W, 3, "F");
  if (logo) { try { doc.addImage(logo, "PNG", 32, 20, 52, 52); } catch {} }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold"); doc.setFontSize(20);
  doc.text("EmoSense AI", 100, 42);
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  doc.text("Clinical Pre-Consultation Summary", 100, 58);
  doc.setFontSize(9);
  doc.text("Confidential — For Licensed Therapist Use Only · Non-Diagnostic", 100, 74);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date(generated_at).toLocaleString()}`, W - 32, 42, { align: "right" });
  doc.text(`Report ID: ES-${userId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`, W - 32, 58, { align: "right" });
  doc.text(`Observation window: last 90 days`, W - 32, 74, { align: "right" });

  let y = 118;
  doc.setTextColor(30, 30, 40);

  // ---------- Client Overview (no PII beyond age/gender/role) ----------
  section(doc, "Client Overview", y); y += 22;
  autoTable(doc, {
    startY: y, theme: "plain",
    styles: { fontSize: 10, cellPadding: 4, textColor: [40, 40, 50] },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 160, textColor: [90, 90, 110] } },
    body: [
      ["Anonymized ID", userId],
      ["Age", profile.age != null ? String(profile.age) : "—"],
      ["Gender", profile.gender || "—"],
      ["Role / Profession", profile.profession || "—"],
      ["Account created", fmt(profile.account_created_at)],
      ["Trusted contact on file", profile.trusted_contact_on_file ? "Yes" : "No"],
      ["Engagement volume (window)", `${metrics.engagement.user_messages} self-report entries`],
      ["Peak activity hour", `${metrics.engagement.peak_hour_local_server}:00`],
      ["Late-night activity share (00–05h)", `${Math.round(metrics.engagement.late_night_share_0_5h * 100)}%`],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // ---------- Clinical Impression ----------
  if (y > H - 180) { doc.addPage(); y = 60; }
  section(doc, "Clinical Impression", y); y += 20;
  y = wrapPara(doc, summary.clinical_impression, y, W);
  y += 6;

  // ---------- Risk Assessment (prominent) ----------
  if (y > H - 200) { doc.addPage(); y = 60; }
  section(doc, "Risk Assessment", y); y += 16;
  const rColor = RISK_COLOR[summary.risk_assessment.level] || [120, 120, 130];
  doc.setFillColor(rColor[0], rColor[1], rColor[2]);
  doc.roundedRect(40, y, 140, 22, 4, 4, "F");
  doc.setTextColor(255, 255, 255); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(`RISK: ${String(summary.risk_assessment.level).toUpperCase()}`, 110, y + 15, { align: "center" });
  doc.setTextColor(30, 30, 40); doc.setFont("helvetica", "normal");
  y += 30;
  autoTable(doc, {
    startY: y, theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 150 } },
    body: [
      ["Risk factors", (summary.risk_assessment.risk_factors || []).join(" · ") || "None identified"],
      ["Protective factors", (summary.risk_assessment.protective_factors || []).join(" · ") || "Limited"],
      ["Safety plan recommended", summary.risk_assessment.safety_plan_recommended ? "Yes — prioritize first session" : "Not indicated at this time"],
      ["Clinical notes", summary.risk_assessment.notes || "—"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // ---------- Presenting Concerns ----------
  if (y > H - 160) { doc.addPage(); y = 60; }
  section(doc, "Presenting Concerns", y); y += 18;
  y = bulletList(doc, summary.presenting_concerns || [], y, W);

  // ---------- Provisional Themes ----------
  if (y > H - 220) { doc.addPage(); y = 60; }
  section(doc, "Provisional Clinical Themes (Non-Diagnostic)", y); y += 22;
  autoTable(doc, {
    startY: y, theme: "striped",
    styles: { fontSize: 9.5, cellPadding: 5, overflow: "linebreak" },
    headStyles: { fillColor: [ACCENT.r, ACCENT.g, ACCENT.b], textColor: 20 },
    columnStyles: { 0: { cellWidth: 170 }, 1: { cellWidth: 90 } },
    head: [["Theme", "Evidence strength", "Clinical basis"]],
    body: (summary.provisional_themes || []).map((t: any) => [t.theme, t.evidence_strength, t.clinical_evidence]),
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // ---------- Cognitive & Behavioural ----------
  if (y > H - 220) { doc.addPage(); y = 60; }
  section(doc, "Cognitive Patterns", y); y += 18;
  y = bulletList(doc, summary.cognitive_patterns || [], y, W);

  if (y > H - 180) { doc.addPage(); y = 60; }
  section(doc, "Behavioural Observations", y); y += 18;
  y = bulletList(doc, summary.behavioural_observations || [], y, W);

  // ---------- Functional Impact ----------
  if (y > H - 200) { doc.addPage(); y = 60; }
  section(doc, "Functional Impact", y); y += 22;
  autoTable(doc, {
    startY: y, theme: "grid",
    styles: { fontSize: 9.5, cellPadding: 5 },
    headStyles: { fillColor: [BRAND.r, BRAND.g, BRAND.b], textColor: 255 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 160 } },
    body: [
      ["Work / Academic", summary.functional_impact.work_or_academic || "—"],
      ["Relationships", summary.functional_impact.relationships || "—"],
      ["Self-care & Sleep", summary.functional_impact.self_care_and_sleep || "—"],
    ],
  });
  y = (doc as any).lastAutoTable.finalY + 18;

  // ---------- Recommended Screenings ----------
  if (y > H - 200) { doc.addPage(); y = 60; }
  section(doc, "Recommended Screening Instruments", y); y += 18;
  y = bulletList(doc, summary.recommended_screenings || [], y, W);

  // ---------- Suggested Interventions ----------
  if (y > H - 200) { doc.addPage(); y = 60; }
  section(doc, "Suggested Evidence-Based Interventions", y); y += 18;
  y = bulletList(doc, summary.suggested_interventions || [], y, W);

  // ---------- First-Session Focus ----------
  if (y > H - 200) { doc.addPage(); y = 60; }
  section(doc, "Suggested First-Session Focus Areas", y); y += 18;
  y = bulletList(doc, summary.therapist_focus_areas || [], y, W);

  // ---------- Prognosis & Limitations ----------
  if (y > H - 200) { doc.addPage(); y = 60; }
  section(doc, "Prognostic Note", y); y += 18;
  y = wrapPara(doc, summary.prognosis_note, y, W); y += 8;

  if (y > H - 160) { doc.addPage(); y = 60; }
  section(doc, "Limitations & Data Provenance", y); y += 18;
  y = wrapPara(doc, summary.limitations, y, W);

  // ---------- Privacy notice ----------
  if (y > H - 120) { doc.addPage(); y = 60; }
  doc.setFillColor(245, 240, 255);
  doc.roundedRect(32, y, W - 64, 60, 6, 6, "F");
  doc.setTextColor(BRAND.r, BRAND.g, BRAND.b);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.text("Privacy Statement", 44, y + 18);
  doc.setFont("helvetica", "normal"); doc.setTextColor(60, 60, 70); doc.setFontSize(9);
  const privacy = "This report contains NO raw messages, quotes, names, places, or identifying content from the client's conversations. All observations are AI-generated clinical translations of behavioural signals from the EmoSense platform. It is intended as a pre-consultation aid, is non-diagnostic, and must be interpreted by a licensed clinician alongside direct assessment.";
  doc.text(doc.splitTextToSize(privacy, W - 88), 44, y + 34);

  // ---------- Footer ----------
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(220);
    doc.line(32, H - 46, W - 32, H - 46);
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(
      "EmoSense AI · Confidential clinical summary — computer-generated, non-diagnostic, no raw user content included.",
      W / 2, H - 32, { align: "center", maxWidth: W - 80 }
    );
    doc.text(`Page ${i} of ${pageCount}`, W - 32, H - 18, { align: "right" });
    doc.text("emosense-companion.lovable.app", 32, H - 18);
  }

  const safeName = (displayName || userId.slice(0, 8)).replace(/[^a-z0-9]+/gi, "_");
  doc.save(`EmoSense_ClinicalSummary_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

function section(doc: jsPDF, title: string, y: number) {
  const W = doc.internal.pageSize.getWidth();
  doc.setFillColor(BRAND.r, BRAND.g, BRAND.b);
  doc.rect(32, y - 12, 4, 16, "F");
  doc.setTextColor(30, 30, 40);
  doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(title, 44, y);
  doc.setDrawColor(230);
  doc.line(44, y + 4, W - 32, y + 4);
  doc.setFont("helvetica", "normal");
}

function wrapPara(doc: jsPDF, text: string, y: number, W: number): number {
  doc.setFontSize(10); doc.setTextColor(40, 40, 50);
  const lines = doc.splitTextToSize(text || "—", W - 80);
  const H = doc.internal.pageSize.getHeight();
  if (y + lines.length * 13 > H - 80) { doc.addPage(); y = 60; }
  doc.text(lines, 40, y);
  return y + lines.length * 13;
}

function bulletList(doc: jsPDF, items: string[], y: number, W: number): number {
  doc.setFontSize(10); doc.setTextColor(40, 40, 50);
  const H = doc.internal.pageSize.getHeight();
  if (!items.length) { doc.setTextColor(MUTED.r, MUTED.g, MUTED.b); doc.text("—", 40, y); return y + 14; }
  for (const it of items) {
    const lines = doc.splitTextToSize(`• ${it}`, W - 80);
    if (y + lines.length * 13 > H - 80) { doc.addPage(); y = 60; }
    doc.text(lines, 40, y);
    y += lines.length * 13 + 3;
  }
  return y;
}
