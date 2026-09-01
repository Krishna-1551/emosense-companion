/**
 * EmoSense Care Bridge — deterministic support-level engine + verified resources.
 *
 * Design rules:
 *  - Helpline data is a controlled constant. The language model NEVER supplies numbers.
 *  - Level detection is rule based (risk score + context + explicit statements + user answer).
 *  - Nothing here blocks chat: every DB write is fire-and-forget and failure-tolerant.
 */

import { supabase } from "@/integrations/supabase/client";

export type SupportLevel = 0 | 1 | 2 | 3;
export type CareLang = "en" | "hi";

export const CARE_DISCLAIMER_EN =
  "EMOSENSE provides emotional-support tools and early assistance. It does not diagnose medical conditions or replace professional mental-health care. In an immediate emergency, contact local emergency services.";
export const CARE_DISCLAIMER_HI =
  "EMOSENSE भावनात्मक सहयोग और शुरुआती सहायता देता है। यह किसी बीमारी की पहचान नहीं करता और पेशेवर मानसिक-स्वास्थ्य देखभाल का विकल्प नहीं है। तत्काल आपात स्थिति में स्थानीय आपातकालीन सेवाओं से संपर्क करें।";

/** Verified, human-maintained resource list (India). Never model-generated. */
export const VERIFIED_HELPLINES = [
  { id: "telemanas", label: "Tele-MANAS", labelHi: "टेली-मानस", number: "14416", detail: "24×7 • Govt. of India mental health", detailHi: "24×7 • भारत सरकार मानसिक स्वास्थ्य" },
  { id: "telemanas_alt", label: "Tele-MANAS (alternate)", labelHi: "टेली-मानस (वैकल्पिक)", number: "1800-89-14416", detail: "Toll-free alternative line", detailHi: "टोल-फ्री वैकल्पिक नंबर" },
  { id: "emergency", label: "Emergency", labelHi: "आपातकाल", number: "112", detail: "Police • Ambulance • Fire", detailHi: "पुलिस • एम्बुलेंस • अग्निशमन" },
] as const;

export const telHref = (n: string) => `tel:${n.replace(/[^\d+]/g, "")}`;

/* ------------------------------------------------------------------ *
 * Level detection
 * ------------------------------------------------------------------ */

const IMMEDIATE_INTENT =
  /\b(kill myself|end my life|end it all|i want to die|suicide tonight|jump off|overdose right now|hang myself|cut myself now|not safe right now|emosense_test_immediate_danger)\b|आत्महत्या|जान दे दूं|मरना चाहता|मरना चाहती/i;

const HOPELESS =
  /\b(hopeless|no point|pointless|worthless|can'?t go on|give up|nothing matters|no way out|tired of living|burden to everyone)\b|बेकार|कोई फायदा नहीं|थक गया|थक गई|उम्मीद नहीं/i;

const HARM_LANGUAGE =
  /\b(hurt myself|self ?harm|harm myself|disappear forever|don'?t want to wake up)\b/i;

const NEGATIVE_EMOTIONS = ["sadness", "anxiety", "stress", "fear", "loneliness", "anger", "grief"];

export type CareInputMsg = {
  role: "user" | "assistant";
  content: string;
  emotion?: string | null;
  risk_level?: string | null;
};

export type LevelAssessment = {
  level: SupportLevel;
  riskBand: "low" | "moderate" | "high";
  reasons: string[];
};

/** Multi-signal assessment — risk score is only one input. */
export function assessSupportLevel(messages: CareInputMsg[]): LevelAssessment {
  const users = messages.filter((m) => m.role === "user");
  const last = users[users.length - 1];
  if (!last) return { level: 0, riskBand: "low", reasons: [] };

  const recent = users.slice(-5);
  const text = last.content ?? "";
  const recentText = recent.map((m) => m.content ?? "").join(" \n ");
  const risk = (last.risk_level ?? "").toLowerCase();
  const emotions = recent.map((m) => (m.emotion ?? "").toLowerCase());
  const negCount = emotions.filter((e) => NEGATIVE_EMOTIONS.includes(e)).length;

  const reasons: string[] = [];
  const riskBand: LevelAssessment["riskBand"] =
    risk === "high" ? "high" : risk === "moderate" ? "moderate" : "low";

  // Level 3 — only on explicit, direct statements of immediate danger.
  if (IMMEDIATE_INTENT.test(text)) {
    return { level: 3, riskBand: "high", reasons: ["explicit_immediate_statement"] };
  }

  // Level 2 — concerning pattern without clear evidence of immediate danger.
  if (risk === "high") reasons.push("risk_high");
  if (HARM_LANGUAGE.test(recentText)) reasons.push("potentially_harmful_language");
  if (HOPELESS.test(recentText)) reasons.push("hopelessness_language");
  if (negCount >= 3) reasons.push("repeated_distress");
  if (risk === "moderate" && negCount >= 2) reasons.push("sustained_moderate_risk");

  if (reasons.length >= 1 && (risk === "high" || reasons.length >= 2)) {
    return { level: 2, riskBand, reasons };
  }

  // Level 1 — everyday difficulty.
  const everyday =
    NEGATIVE_EMOTIONS.includes((last.emotion ?? "").toLowerCase()) ||
    risk === "moderate" ||
    /\b(stress|stressed|exam|deadline|pressure|lonely|anxious|tired|frustrat|sad|overwhelm)\b|तनाव|परीक्षा|अकेला|चिंता/i.test(text);

  if (everyday) return { level: 1, riskBand, reasons: reasons.length ? reasons : ["everyday_difficulty"] };

  return { level: 0, riskBand, reasons: [] };
}

/** Hindi / Devanagari or Hinglish cue detection for interface mirroring. */
export function detectCareLang(messages: CareInputMsg[]): CareLang {
  const recent = messages.filter((m) => m.role === "user").slice(-3).map((m) => m.content ?? "").join(" ");
  if (/[\u0900-\u097F]/.test(recent)) return "hi";
  if (/\b(kya|kaise|nahi|mujhe|mera|bahut|yaar|karu|batao|hoon|thik)\b/i.test(recent)) return "hi";
  return "en";
}

/* ------------------------------------------------------------------ *
 * Level 1 support plan (deterministic — works even if AI is down)
 * ------------------------------------------------------------------ */

export type SupportPlan = {
  acknowledgement: string;
  activity: { title: string; steps: string[] };
  todayAction: string;
};

const PLANS: Record<string, SupportPlan> = {
  anxiety: {
    acknowledgement: "That sounds like a lot to hold at once. Let's make the next few minutes a little lighter.",
    activity: { title: "4-7-8 breathing (2 minutes)", steps: ["Breathe in through your nose for 4 counts", "Hold gently for 7", "Breathe out slowly for 8", "Repeat four times"] },
    todayAction: "Write down the one thing worrying you most, and the smallest next step for it.",
  },
  stress: {
    acknowledgement: "Pressure like this is real, and it makes sense that you're feeling stretched.",
    activity: { title: "5-4-3-2-1 grounding", steps: ["Name 5 things you can see", "4 you can touch", "3 you can hear", "2 you can smell", "1 you can taste"] },
    todayAction: "Pick one task, set a 15-minute timer, and stop when it rings.",
  },
  sadness: {
    acknowledgement: "Thank you for saying it out loud. Heaviness like this deserves some gentleness.",
    activity: { title: "Warmth reset (3 minutes)", steps: ["Sit somewhere comfortable", "Hold something warm — tea, water, a blanket", "Take six slow breaths", "Notice one thing that feels okay right now"] },
    todayAction: "Do one small kind thing for yourself today — a walk, a shower, a favourite song.",
  },
  loneliness: {
    acknowledgement: "Feeling unseen is genuinely hard, even when everything looks fine from outside.",
    activity: { title: "One-line reach out", steps: ["Think of one person you feel neutral or safe with", "Send a single line — 'hey, thinking of you'", "No expectation of a reply"] },
    todayAction: "Spend ten minutes somewhere with other people around — a shop, a park, a corridor.",
  },
  anger: {
    acknowledgement: "Something clearly crossed a line for you. That reaction makes sense.",
    activity: { title: "Physical discharge (2 minutes)", steps: ["Stand up and shake out your hands and shoulders", "Push against a wall for 10 seconds, then release", "Take three long exhales"] },
    todayAction: "Write the unsent version of what you'd like to say — for you, not to send.",
  },
  default: {
    acknowledgement: "I'm glad you shared that. Let's take one small, doable step together.",
    activity: { title: "Box breathing (2 minutes)", steps: ["In for 4", "Hold for 4", "Out for 4", "Hold for 4", "Repeat five times"] },
    todayAction: "Choose one thing you can finish in ten minutes and do only that.",
  },
};

export function buildSupportPlan(emotion?: string | null): SupportPlan {
  const key = (emotion ?? "").toLowerCase();
  if (key === "fear") return PLANS.anxiety;
  return PLANS[key] ?? PLANS.default;
}

/* ------------------------------------------------------------------ *
 * Event log (privacy-minimal, failure-tolerant)
 * ------------------------------------------------------------------ */

export type CareEventName =
  | "support_plan_offered"
  | "safety_check_displayed"
  | "user_confirmed_safe"
  | "user_unsure"
  | "urgent_support_requested"
  | "trusted_contact_action_selected"
  | "helpline_action_selected"
  | "follow_up_requested"
  | "false_alarm_reported";

const loggedOnce = new Set<string>();

export async function logCareEvent(opts: {
  userId: string;
  conversationId?: string | null;
  event: CareEventName;
  level?: SupportLevel;
  riskBand?: string;
  humanSupportRequested?: boolean;
  confirmedSafe?: boolean | null;
  followUpStatus?: string | null;
  /** Dedupe key — prevents duplicate rows from repeated clicks / re-renders. */
  dedupeKey?: string;
}): Promise<string | null> {
  const key = opts.dedupeKey;
  if (key) {
    if (loggedOnce.has(key)) return null;
    loggedOnce.add(key);
  }
  try {
    const { data, error } = await supabase
      .from("care_events")
      .insert({
        user_id: opts.userId,
        conversation_id: opts.conversationId ?? null,
        event_name: opts.event,
        support_level: opts.level && opts.level > 0 ? opts.level : null,
        risk_band: opts.riskBand ?? null,
        human_support_requested: !!opts.humanSupportRequested,
        confirmed_safe: opts.confirmedSafe ?? null,
        follow_up_status: opts.followUpStatus ?? null,
      })
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return data?.id ?? null;
  } catch {
    if (key) loggedOnce.delete(key);
    return null; // never block or surface — Care Bridge must degrade silently
  }
}

/* ------------------------------------------------------------------ *
 * Validation helpers
 * ------------------------------------------------------------------ */

export const isValidPhone = (v: string) => /^\+?[\d][\d\s\-()]{6,19}$/.test(v.trim());
export const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const TRUSTED_CONTACT_MESSAGE =
  "Someone who has listed you as a trusted support contact has requested your assistance. Please contact them as soon as possible.";

/* ------------------------------------------------------------------ *
 * Follow-up options
 * ------------------------------------------------------------------ */

export const FOLLOW_UP_OPTIONS = [
  { id: "30m", label: "In 30 minutes", labelHi: "30 मिनट में", minutes: 30 },
  { id: "2h", label: "In 2 hours", labelHi: "2 घंटे में", minutes: 120 },
  { id: "tomorrow", label: "Tomorrow", labelHi: "कल", minutes: 60 * 24 },
  { id: "none", label: "No follow-up", labelHi: "कोई फ़ॉलो-अप नहीं", minutes: 0 },
] as const;

/* ------------------------------------------------------------------ *
 * Interface copy (English + Hindi)
 * ------------------------------------------------------------------ */

export const CARE_T = {
  en: {
    planTitle: "My Support Plan",
    tryThis: "Try this now",
    todayAction: "One thing for today",
    startActivity: "Start activity",
    saveForLater: "Save for later",
    continueTalking: "Continue talking",
    whatHelped: "What helped me?",
    helped: "This helped",
    notHelped: "Not really",
    thanks: "Thank you — noted for next time.",
    saved: "Saved to your support plan.",
    safetyTitle: "A gentle check-in",
    safetyBody: "You seem to be going through a very difficult moment. I want to check on your safety — do you feel safe right now?",
    why: "I'm checking because your recent message suggested that you may be feeling unsafe.",
    yesSafe: "Yes, I am safe",
    unsure: "I am not sure",
    needHelp: "No, I need help",
    misunderstood: "This was misunderstood",
    stillNeed: "I still need support",
    urgentTitle: "Your safety matters",
    urgentBody: "EMOSENSE is not an emergency service, but you do not have to handle this moment alone. Please connect with a trusted person or qualified support service now.",
    contactTrusted: "Contact my trusted person",
    viewPlan: "View my personal safety plan",
    keepTalking: "Continue talking while I seek help",
    addTrusted: "Add trusted contact",
    followUpAsk: "Would you like me to check in with you later?",
    followUpStored: "Saved. I'll show this check-in the next time you open EmoSense.",
    followUpTitle: "How are you feeling now compared with earlier?",
    better: "Better",
    same: "About the same",
    worse: "Worse",
    wantHuman: "I would like human support",
  },
  hi: {
    planTitle: "मेरा सहयोग प्लान",
    tryThis: "अभी यह आज़माएँ",
    todayAction: "आज के लिए एक काम",
    startActivity: "गतिविधि शुरू करें",
    saveForLater: "बाद के लिए सेव करें",
    continueTalking: "बात जारी रखें",
    whatHelped: "मुझे किससे मदद मिली?",
    helped: "इससे मदद मिली",
    notHelped: "खास नहीं",
    thanks: "धन्यवाद — अगली बार ध्यान रखूँगा।",
    saved: "आपके सहयोग प्लान में सेव हो गया।",
    safetyTitle: "एक सौम्य जाँच",
    safetyBody: "लगता है आप बहुत कठिन दौर से गुजर रहे हैं। मैं आपकी सुरक्षा जानना चाहता हूँ — क्या आप अभी सुरक्षित महसूस कर रहे हैं?",
    why: "मैं यह पूछ रहा हूँ क्योंकि आपके हाल के संदेश से लगा कि आप असुरक्षित महसूस कर रहे हो सकते हैं।",
    yesSafe: "हाँ, मैं सुरक्षित हूँ",
    unsure: "मुझे ठीक से नहीं पता",
    needHelp: "नहीं, मुझे मदद चाहिए",
    misunderstood: "यह गलत समझा गया",
    stillNeed: "मुझे अभी भी सहयोग चाहिए",
    urgentTitle: "आपकी सुरक्षा महत्वपूर्ण है",
    urgentBody: "EMOSENSE आपातकालीन सेवा नहीं है, लेकिन आपको यह पल अकेले नहीं संभालना है। कृपया किसी भरोसेमंद व्यक्ति या योग्य सहायता सेवा से अभी संपर्क करें।",
    contactTrusted: "मेरे भरोसेमंद व्यक्ति से संपर्क",
    viewPlan: "मेरा व्यक्तिगत सुरक्षा प्लान देखें",
    keepTalking: "मदद लेते हुए बात जारी रखें",
    addTrusted: "भरोसेमंद संपर्क जोड़ें",
    followUpAsk: "क्या मैं आपसे बाद में हाल पूछूँ?",
    followUpStored: "सेव हो गया। अगली बार EmoSense खोलने पर यह जाँच दिखेगी।",
    followUpTitle: "पहले की तुलना में अब कैसा महसूस हो रहा है?",
    better: "बेहतर",
    same: "लगभग वैसा ही",
    worse: "और खराब",
    wantHuman: "मुझे मानवीय सहयोग चाहिए",
  },
} as const;
