export type SafetyTier = "none" | "concern" | "urgent";
export type LanguageStyle = "english" | "hindi" | "hinglish";

const URGENT_PATTERNS = [
  /\bsuicid\w*/i,
  /\bkill (myself|me)\b/i,
  /\bend (my life|it all|everything)\b/i,
  /\bdon'?t want to (live|be here|exist)\b/i,
  /\bno reason to (live|go on)\b/i,
  /\b(hurt|harm|cut) myself\b/i,
  /\bself[- ]?harm\b/i,
  /\boverdose\b/i,
  /\bbetter off (dead|gone)\b/i,
  /\bmarna chahta|marna chahti|jeena nahi chahta|jeena nahi chahti\b/i,
  /\bkhud\s*ko (maar|nuksan)|apni jaan\b/i,
  /(?:अपनी जान लेना|जीना नहीं चाहता|जीना नहीं चाहती|खुद को नुकसान)/,
];

const CONCERN_PATTERNS = [
  /\bhopeless|worthless|pointless\b/i,
  /\bcan'?t (go on|take it|do this anymore)\b/i,
  /\bgive up\b/i,
  /\bnobody (cares|would miss me)\b/i,
  /\bkoi faayda nahi|bekaar hoon|sab khatam\b/i,
  /(?:निराश|बेकार|कोई फायदा नहीं|सब खत्म)/,
];

const NEGATED_URGENT_PATTERNS = [
  /\b(?:not|never) (?:suicidal|going to (?:hurt|kill) myself)\b/i,
  /\bi (?:don'?t|do not) (?:want|plan|intend) to (?:hurt|harm|kill) myself\b/i,
  /\b(?:suicidal|self[- ]?harm) (?:thoughts? )?(?:but )?(?:no|without) (?:plan|intent)\b/i,
  /\bsuicidal thoughts?.*(?:koi|no).*(?:plan|intent).*(?:nahi|no)\b/i,
  /\bmain khud ko nuksan nahi|main marna nahi chahta|main marna nahi chahti\b/i,
  /(?:खुद को नुकसान पहुँचाने की योजना नहीं|मरना नहीं चाहता|मरना नहीं चाहती)/,
];

export function assessSafetyText(text: string): SafetyTier {
  const value = String(text || "").trim();
  if (!value) return "none";

  const urgent = URGENT_PATTERNS.some((pattern) => pattern.test(value));
  const explicitlyNegated = NEGATED_URGENT_PATTERNS.some((pattern) => pattern.test(value));
  if (urgent && !explicitlyNegated) return "urgent";
  if (urgent || CONCERN_PATTERNS.some((pattern) => pattern.test(value))) return "concern";
  return "none";
}

export function detectLanguageStyle(text: string): LanguageStyle {
  const value = String(text || "");
  if (/\p{Script=Devanagari}/u.test(value)) {
    return /\b(stress|feel|help|please|safe|plan|call|friend|family)\b/i.test(value)
      ? "hinglish"
      : "hindi";
  }
  const romanHindi = /\b(mujhe|main|mera|meri|nahi|haan|kya|kaise|bahut|bohot|yaar|aap|tum|karna|hoon|hai)\b/i;
  return romanHindi.test(value) ? "hinglish" : "english";
}

/**
 * Model-independent urgent response. The first turn establishes immediate
 * safety and human connection; later turns can continue conversationally.
 */
export function buildUrgentSafetyReply(text: string): string {
  const style = detectLanguageStyle(text);
  if (style === "hindi") {
    return "आपने यह बताया, यह बहुत महत्वपूर्ण है। क्या आप अभी तुरंत खतरे में हैं, या आपने खुद को नुकसान पहुँचाने की कोई योजना बनाई है? कृपया अभी अकेले न रहें—किसी भरोसेमंद व्यक्ति को अपने पास बुलाएँ और भारत में 24×7 Tele-MANAS के 14416 या 1800-89-14416 पर कॉल करें। अगर खतरा तुरंत है, स्थानीय आपातकालीन सेवा से अभी संपर्क करें।";
  }
  if (style === "hinglish") {
    return "Aapne yeh bataya, yeh bahut important hai. Kya aap abhi immediate danger mein hain, ya khud ko harm karne ka koi plan banaya hai? Please abhi akele mat rahiye—kisi trusted person ko apne paas bulaiye aur India mein 24×7 Tele-MANAS 14416 ya 1800-89-14416 par call kijiye. Agar danger immediate hai, local emergency service ko abhi contact kijiye.";
  }
  return "Thank you for telling me—this needs immediate care. Are you in immediate danger right now, or have you made a plan to harm yourself? Please do not stay alone: ask a trusted person to be with you and, in India, call the 24×7 Tele-MANAS service at 14416 or 1800-89-14416. If the danger is immediate, contact your local emergency service now.";
}
