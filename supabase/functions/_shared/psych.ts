// ============================================================================
// EmoSense — Psychological Intelligence Engine (shared module)
// ----------------------------------------------------------------------------
// Modular, reusable layer that sits between raw emotion detection and the AI
// response engine. It is NOT a diagnostic system: it recognises patterns,
// assesses severity, selects a response strategy and decides escalation.
//
// Sub-modules exposed here:
//   1. Case Knowledge Base retrieval  -> retrievePsychCases()
//   2. Context analysis               -> analyseContext()
//   3. Severity assessment            -> assessSeverity()
//   4. Response strategy assembly     -> buildPsychBlock()
//   5. Safety / escalation            -> included in assessSeverity()
//   6. Emotional timeline persistence -> recordAssessment()
// ============================================================================

export type PsychCase = {
  case_code: string;
  category: string;
  subcategory: string | null;
  user_situation: string;
  detected_signals: string[] | null;
  possible_patterns: string[] | null;
  severity_level: number;
  response_strategy: string;
  follow_up_questions: string[] | null;
  avoid_saying: string[] | null;
  next_steps: string[] | null;
  escalation_criteria: string | null;
  source: string | null;
  confidence: number | null;
  rank: number | null;
};

/** Non-negotiable safety + non-diagnostic contract shared by every surface. */
export const PSYCH_CORE_CONTRACT = `PSYCHOLOGICAL INTELLIGENCE CONTRACT (non-negotiable):
- You are an emotional-support and pattern-recognition companion. You are NOT a psychologist, psychiatrist, doctor, counsellor or emergency service.
- NEVER state or imply a diagnosis. Never say "you have depression/anxiety/ADHD/trauma". Use hedged, experience-level language ("what you're describing sounds like a lot of ongoing pressure", "some of these experiences can be linked to...").
- Distinguish patterns/symptoms from confirmed clinical conditions. Communicate uncertainty when the picture is unclear.
- Do not keyword-match. "I'm tired" is not depression. Weigh context, duration, tone, sleep, motivation, functional impact and earlier messages before forming any interpretation.
- When uncertainty is high, ask ONE natural clarifying question (duration, frequency, or functional impact) instead of interpreting.
- Never use hollow reassurance ("everything will be fine", "stay positive", "others have it worse").
- Never provide information that could facilitate harm.
- NEVER explain the cause of what someone is feeling as if it were settled when several explanations remain possible. Banned: "your system is craving a break", "this is definitely burnout", "you're experiencing depression", "this is just stress", "your body is telling you...".
  Use instead: "this can happen with prolonged stress or burnout, but there can be other explanations too", "the pattern you're describing is worth taking seriously", "I'd like to understand a little more before drawing any conclusions".
- TONE: warm but professional and respectful. Never use intimate pet names — no "hon", "honey", "sweetie", "dear", "babe", "love". Address the person plainly ("you").
- Do not flood the reply with emotional language. One genuine acknowledgment is enough; the rest of the reply should do real reasoning work.`;

/** Sanitise free text into something safe for websearch_to_tsquery. */
function toSearchQuery(text: string, extra: string[] = []): string {
  const cleaned = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3)
    .slice(0, 40);
  return [...cleaned, ...extra.filter(Boolean)].join(" ").trim();
}

/** 1. CASE KNOWLEDGE BASE — retrieve the most relevant enabled cases. */
export async function retrievePsychCases(
  client: any,
  message: string,
  hints: string[] = [],
  limit = 4,
): Promise<PsychCase[]> {
  const q = toSearchQuery(message, hints);
  if (!q) return [];
  try {
    const { data, error } = await client.rpc("match_psych_cases", { _query: q, _limit: limit });
    if (error) {
      console.error("match_psych_cases error", error.message);
      return [];
    }
    return (data as PsychCase[]) || [];
  } catch (e) {
    console.error("retrievePsychCases failed", e);
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. CONTEXT ANALYSIS — linguistic markers that separate "a bad day" from a
// persistent pattern. Deliberately conservative: markers raise *questions*,
// not conclusions.
// ---------------------------------------------------------------------------
const DURATION_MARKERS = [
  /\b(weeks?|months?|years?)\b/i, /\bevery ?day\b/i, /\ball the time\b/i, /\balways\b/i,
  /\bfor a long time\b/i, /\bstill\b/i, /\bkai (din|hafte|mahine)\b/i, /\broz\b/i,
  /\bhamesha\b/i, /\bmahino se\b/i, /\bhafto se\b/i, /\blast few (weeks|months)\b/i,
];
const FUNCTIONAL_MARKERS = [
  /\bcan'?t (work|study|focus|concentrate|get out of bed|eat|sleep)\b/i,
  /\bstopped (going|eating|studying|working|talking)\b/i,
  /\bmissed (classes|work|office|college)\b/i,
  /\bnothing (matters|interests|feels)\b/i,
  /\bno energy\b/i, /\bkaam nahi ho raha\b/i, /\bpadhai nahi ho rahi\b/i,
  /\bbed se uth nahi\b/i,
];
const SOMATIC_MARKERS = [
  /\bcan'?t (sleep|breathe)\b/i, /\bheart (races|racing|pounding)\b/i, /\bappetite\b/i,
  /\bshaking\b/i, /\bchest (pain|tight)\b/i, /\bneend nahi\b/i, /\bghabrahat\b/i,
];
const HOPELESS_MARKERS = [
  /\bhopeless\b/i, /\bworthless\b/i, /\bno point\b/i, /\bpointless\b/i,
  /\bnothing will change\b/i, /\bburden\b/i, /\bkoi faayda nahi\b/i, /\bbekaar hoon\b/i,
];
const CRISIS_MARKERS = [
  /\bsuicid\w*/i, /\bkill (myself|me)\b/i, /\bend (it|my life|everything)\b/i,
  /\bdon'?t want to (live|be here|exist)\b/i, /\bno reason to (live|go on)\b/i,
  /\bhurt myself\b/i, /\bself[- ]?harm\b/i, /\bcut myself\b/i, /\boverdose\b/i,
  /\bbetter off (dead|without me|gone)\b/i, /\bnobody would miss\b/i,
  /\bmarna chahta\b/i, /\bjeena nahi chahta\b/i, /\bkhudko (maar|nuksan)\b/i,
  /\b(beat|hits|hitting) me\b/i, /\bnot safe at home\b/i,
];

export type ContextSignals = {
  duration_hint: boolean;
  functional_impact: boolean;
  somatic: boolean;
  hopelessness: boolean;
  crisis: boolean;
  continuity: string[];
};

/** Analyse the current message plus earlier assessments for continuity. */
export function analyseContext(
  message: string,
  priorAssessments: { patterns: string[] | null; matched_case_codes: string[] | null }[] = [],
): ContextSignals {
  const t = String(message || "");
  const hit = (arr: RegExp[]) => arr.some((r) => r.test(t));
  const continuity = new Set<string>();
  for (const a of priorAssessments) for (const p of a.patterns || []) continuity.add(p);
  return {
    duration_hint: hit(DURATION_MARKERS),
    functional_impact: hit(FUNCTIONAL_MARKERS),
    somatic: hit(SOMATIC_MARKERS),
    hopelessness: hit(HOPELESS_MARKERS),
    crisis: hit(CRISIS_MARKERS),
    continuity: Array.from(continuity).slice(0, 6),
  };
}

// ---------------------------------------------------------------------------
// 3/5. SEVERITY ASSESSMENT + ESCALATION
// Level 1 normal distress · 2 significant distress · 3 potential MH concern
// Level 4 high-risk safety situation.
// ---------------------------------------------------------------------------
export type SeverityResult = {
  level: 1 | 2 | 3 | 4;
  escalate: boolean;
  uncertainty: number; // 0 (clear) .. 1 (very unclear)
  reasons: string[];
};

export function assessSeverity(opts: {
  message: string;
  riskLevel?: string | null;
  ctx: ContextSignals;
  cases: PsychCase[];
  repeatedNegative?: boolean;
  recentHighRisk?: number;
}): SeverityResult {
  const { ctx, cases } = opts;
  const reasons: string[] = [];
  let level: 1 | 2 | 3 | 4 = 1;

  const caseMax = cases.reduce((m, c) => Math.max(m, c.severity_level || 1), 1);
  if (caseMax > level) { level = Math.min(caseMax, 3) as 1 | 2 | 3; reasons.push(`knowledge-base match at level ${caseMax}`); }

  if (opts.repeatedNegative && level < 2) { level = 2; reasons.push("three consecutive negative turns"); }
  if (ctx.duration_hint && level < 2) { level = 2; reasons.push("duration language present"); }
  if (ctx.duration_hint && (ctx.functional_impact || ctx.somatic) && level < 3) {
    level = 3; reasons.push("persistence + functional/somatic impact");
  }
  if (ctx.hopelessness && level < 3) { level = 3; reasons.push("hopelessness / worthlessness language"); }
  if ((opts.recentHighRisk ?? 0) >= 2 && level < 3) { level = 3; reasons.push("repeated high-risk turns in this conversation"); }

  const crisisCase = cases.some((c) => c.severity_level === 4);
  if (ctx.crisis || opts.riskLevel === "high" || crisisCase) {
    level = 4;
    reasons.push(ctx.crisis ? "explicit safety language detected" : "risk classifier reported high risk");
  }

  // Uncertainty: short message, no duration signal, weak case match → ask, don't interpret.
  const words = String(opts.message || "").trim().split(/\s+/).filter(Boolean).length;
  let uncertainty = 0.3;
  if (words < 8) uncertainty += 0.3;
  if (!ctx.duration_hint) uncertainty += 0.2;
  if (cases.length === 0) uncertainty += 0.2;
  if (ctx.crisis) uncertainty = 0; // safety is never uncertain
  uncertainty = Math.max(0, Math.min(1, Number(uncertainty.toFixed(2))));

  return { level, escalate: level === 4, uncertainty, reasons };
}

// ---------------------------------------------------------------------------
// 4. RESPONSE STRATEGY — turns the assessment into prompt guidance.
// ---------------------------------------------------------------------------
const LEVEL_STRATEGY: Record<number, string> = {
  1: `SEVERITY LEVEL 1 — normal emotional distress.
Response shape: warm validation + one practical coping suggestion + optional single light question. Keep it short and human.`,
  2: `SEVERITY LEVEL 2 — significant emotional distress.
Response shape: deeper validation + ONE contextual question (duration / functional impact / support system) + a concrete small step. Where it fits naturally, encourage leaning on a trusted person, and mention professional support as a normal, non-alarming option.`,
  3: `SEVERITY LEVEL 3 — possible mental-health concern. DO NOT DIAGNOSE.
Response shape: acknowledge the weight seriously, reflect the pattern in plain language (duration + impact), then use careful phrasing close to: "Some of these experiences can be linked to significant emotional or mental-health difficulties, and a qualified professional can help assess what's actually going on." Offer ONE small stabilising action. Do not stack questions.`,
  4: `SEVERITY LEVEL 4 — HIGH-RISK SAFETY SITUATION. SAFETY OVERRIDES EVERYTHING.
- Do not diagnose, do not do therapy, do not lecture, do not moralise, never mention methods or means.
- Warm, calm, steady tone. Short sentences.
- Ask directly and without judgement whether they are safe right now.
- Urge contacting a trusted person physically nearby, and a professional or emergency service.
- Share India support lines plainly: Tele-MANAS 14416, AASRA +91-9820466726, Vandrevala 1860-2662-345.
- Stay present; do not end the conversation or hand off coldly.`,
};

export function buildPsychBlock(opts: {
  cases: PsychCase[];
  severity: SeverityResult;
  ctx: ContextSignals;
  timelineSummary?: string;
  state?: SignalState;
  probe?: ProbePlan;
  trend?: string;
}): string {
  const { cases, severity, ctx } = opts;
  const caseText = cases.length
    ? cases.map((c) => [
        `• ${c.case_code} — ${c.category}${c.subcategory ? " / " + c.subcategory : ""} (case severity ${c.severity_level})`,
        `  situation: ${c.user_situation}`,
        `  possible patterns (NOT diagnoses): ${(c.possible_patterns || []).join(", ") || "n/a"}`,
        `  strategy: ${c.response_strategy}`,
        `  good follow-ups: ${(c.follow_up_questions || []).slice(0, 3).join(" | ") || "n/a"}`,
        `  do NOT say: ${(c.avoid_saying || []).join(" | ") || "n/a"}`,
        `  useful next steps: ${(c.next_steps || []).slice(0, 3).join(" | ") || "n/a"}`,
      ].join("\n")).join("\n")
    : "(no close case match — rely on general support flow and ask one clarifying question)";

  const uncertaintyLine = severity.uncertainty >= 0.5
    ? `UNCERTAINTY HIGH (${severity.uncertainty}). Do NOT interpret or label anything yet. Ask exactly ONE natural clarifying question about duration, frequency or how much it is affecting daily life — e.g. "Has this been mainly today, or has it been going on for several days or weeks?"`
    : `UNCERTAINTY ${severity.uncertainty} — enough context to respond substantively; still stay hedged.`;

  return `${PSYCH_CORE_CONTRACT}

PSYCHOLOGICAL ASSESSMENT FOR THIS TURN (internal — never quote these labels back to the user):
- severity_level: ${severity.level} (${severity.reasons.join("; ") || "baseline"})
- context signals: duration=${ctx.duration_hint} functional_impact=${ctx.functional_impact} somatic=${ctx.somatic} hopelessness=${ctx.hopelessness} safety_language=${ctx.crisis}
- earlier recurring patterns for this person: ${ctx.continuity.join(", ") || "none recorded yet"}
${opts.timelineSummary ? `- emotional timeline: ${opts.timelineSummary}` : ""}

${LEVEL_STRATEGY[severity.level]}

${uncertaintyLine}

RETRIEVED CASE GUIDANCE (curated knowledge base — adapt, never recite):
${caseText}

CONTINUITY RULE: if the recurring patterns above relate to what they just said, connect it explicitly ("this sounds like it's tied to the exam pressure you mentioned earlier") instead of treating it as a brand-new problem.`;
}

/** 6. EMOTIONAL TIMELINE — persist the assessment (no raw chat content). */
export async function recordAssessment(client: any, row: {
  user_id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  emotion?: string | null;
  intensity?: number | null;
  severity_level: number;
  patterns: string[];
  matched_case_codes: string[];
  context_summary?: string | null;
  strategy?: string | null;
  uncertainty?: number | null;
  escalation_triggered: boolean;
}) {
  try {
    const { error } = await client.from("psych_assessments").insert(row);
    if (error) console.error("recordAssessment error", error.message);
  } catch (e) {
    console.error("recordAssessment failed", e);
  }
}

/** Compact, non-identifying summary of the recent emotional timeline. */
export function summariseTimeline(rows: { emotion: string | null; severity_level: number; created_at: string }[]): string {
  if (!rows.length) return "";
  const parts = rows.slice(0, 6).reverse().map((r) => {
    const d = new Date(r.created_at);
    return `${d.toISOString().slice(5, 10)} ${r.emotion || "unknown"}/L${r.severity_level}`;
  });
  return parts.join(" → ");
}
