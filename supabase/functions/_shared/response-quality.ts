export type ResponseStage = "EXPLORE" | "INSIGHT" | "PLAN" | "SOLVE";

const GENERIC_ONLY = [
  /^(i understand|that sounds (hard|tough)|i'?m here for you|stay positive|don'?t worry)[.!\s]*$/i,
  /^(main samajh sakta hoon|sab theek ho jayega|chinta mat karo)[.!\s]*$/i,
];

const UNSAFE_AUTHORITY = [
  /\byou (?:have|definitely have|are suffering from) (?:depression|anxiety|ptsd|adhd|bipolar|ocd)\b/i,
  /\bthis is definitely (?:depression|anxiety|trauma|burnout)\b/i,
  /\b(?:stop|skip|change|increase|decrease) (?:your )?(?:medicine|medication|dose)\b/i,
  /\btake \d+\s*(?:mg|milligrams?)\b/i,
];

const DEPENDENCY_LANGUAGE = [
  /\byou only need me\b/i,
  /\bdon'?t tell (?:anyone|your family|your therapist)\b/i,
  /\bi'?m all you need\b/i,
  /\bi know you better than (?:anyone|your therapist|your family)\b/i,
  /\bstay with me instead of\b/i,
];

const tokens = (value: string) => new Set(
  String(value || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 4),
);

export function evaluateResponseQuality(opts: {
  reply: string;
  userMessage: string;
  stage: ResponseStage;
  urgent?: boolean;
}): string[] {
  const reply = String(opts.reply || "").trim();
  const issues: string[] = [];
  if (!reply) return ["reply is empty"];

  if (GENERIC_ONLY.some((pattern) => pattern.test(reply))) {
    issues.push("reply is only a generic reassurance");
  }
  if (UNSAFE_AUTHORITY.some((pattern) => pattern.test(reply))) {
    issues.push("reply makes a diagnosis or medication instruction outside scope");
  }
  if (DEPENDENCY_LANGUAGE.some((pattern) => pattern.test(reply))) {
    issues.push("reply encourages emotional dependency or secrecy");
  }

  const questionCount = (reply.match(/\?/g) || []).length;
  if (questionCount > 1) issues.push("reply asks more than one question");
  if ((opts.stage === "PLAN" || opts.stage === "SOLVE") && questionCount > 0 && reply.length < 100) {
    issues.push("action-stage reply is mostly another question instead of useful guidance");
  }

  // On substantial messages, require at least one meaningful detail to carry
  // into the response. This is a lightweight grounding check, not diagnosis.
  if (!opts.urgent && opts.userMessage.length >= 60) {
    const userTokens = tokens(opts.userMessage);
    const replyTokens = tokens(reply);
    const grounded = [...userTokens].some((token) => replyTokens.has(token));
    if (!grounded) issues.push("reply does not reference a meaningful detail from the user's message");
  }

  if (opts.urgent) {
    if (!/\b(?:safe|danger|surakshit|khatre?|खतरे|सुरक्षित)\b/i.test(reply)) {
      issues.push("urgent reply lacks a direct safety check");
    }
    if (!/14416|1800-89-14416/.test(reply)) {
      issues.push("urgent reply lacks the official India mental-health support route");
    }
  }
  return issues;
}

const APPROACH_SIGNALS: Record<string, RegExp> = {
  breathing: /\b(breath|breaths|breathe|breathing|saans)\b/i,
  journaling: /\b(write|journal|likh)\b/i,
  outreach: /\b(call|text|message|friend|family|trusted person)\b/i,
  task_block: /\b(\d+\s*(?:min|minute)|timer|one task|ek kaam)\b/i,
  reassurance: /\b(everything will be fine|sab theek|you are not alone|main yahin)\b/i,
};

export function evaluateSemanticNovelty(reply: string, recentReplies: string[]): string[] {
  const current = Object.entries(APPROACH_SIGNALS).filter(([, pattern]) => pattern.test(reply)).map(([name]) => name);
  if (!current.length) return [];
  const recent = new Set(recentReplies.slice(0, 3).flatMap((text) =>
    Object.entries(APPROACH_SIGNALS).filter(([, pattern]) => pattern.test(text)).map(([name]) => name),
  ));
  const repeated = current.filter((name) => recent.has(name));
  return repeated.length === current.length
    ? [`reply repeats the same intervention approach: ${repeated.join(", ")}`]
    : [];
}
