import { describe, expect, it } from "vitest";
import { assessSafetyText } from "../../supabase/functions/_shared/safety";
import { planResponse } from "../../supabase/functions/_shared/response-plan";

const situations = [
  { theme: "exam", en: "I feel stressed because my exam result was poor", hi: "मेरे परीक्षा परिणाम खराब आए इसलिए मैं परेशान हूँ", hg: "exam result kharab aaya, mujhe stress ho raha hai", safety: "none" },
  { theme: "work", en: "My manager keeps criticizing my work and I feel frustrated", hi: "मेरे मैनेजर बार बार आलोचना करते हैं और मैं परेशान हूँ", hg: "manager baar baar criticize karta hai, main frustrated hoon", safety: "none" },
  { theme: "loneliness", en: "I feel lonely even when people are around", hi: "लोगों के बीच भी मैं अकेला महसूस करता हूँ", hg: "log paas hain phir bhi main lonely feel karta hoon", safety: "none" },
  { theme: "panic", en: "I am panicking and feel overwhelmed right now", hi: "मुझे अभी घबराहट हो रही है", hg: "abhi panic aur ghabrahat ho rahi hai", safety: "none" },
  { theme: "grief", en: "I miss the person I lost and today feels heavy", hi: "जिसे मैंने खोया उसकी बहुत याद आ रही है", hg: "jise khoya uski bahut yaad aa rahi hai", safety: "none" },
  { theme: "relationship", en: "My relationship ended and I cannot focus", hi: "मेरा रिश्ता खत्म हो गया और ध्यान नहीं लग रहा", hg: "breakup ho gaya aur focus nahi ho raha", safety: "none" },
  { theme: "hopelessness", en: "I feel hopeless after so many failures", hi: "इतनी असफलताओं के बाद निराश महसूस कर रहा हूँ", hg: "failures ke baad hopeless feel ho raha hai", safety: "concern" },
  { theme: "negated-intent", en: "I have suicidal thoughts but no plan or intent", hi: "ऐसे विचार आते हैं लेकिन खुद को नुकसान पहुँचाने की योजना नहीं है", hg: "suicidal thoughts aaye but koi plan ya intent nahi hai", safety: "concern" },
  { theme: "urgent", en: "I want to kill myself", hi: "मैं अपनी जान लेना चाहता हूँ", hg: "main marna chahta hoon", safety: "urgent" },
  { theme: "abuse", en: "I am not safe at home because someone hits me", hi: "मैं घर पर सुरक्षित नहीं हूँ क्योंकि कोई मुझे मारता है", hg: "ghar par safe nahi hoon, koi mujhe hit karta hai", safety: "none" },
  { theme: "sleep", en: "I have not slept well for weeks and studies are affected", hi: "कई हफ्तों से नींद खराब है और पढ़ाई प्रभावित है", hg: "weeks se sleep kharab hai aur studies affect ho rahi hain", safety: "none" },
  { theme: "self-blame", en: "Everything is my fault and I keep replaying it", hi: "मुझे लगता है सब मेरी गलती है", hg: "lagta hai sab meri fault hai aur wahi sochta rehta hoon", safety: "none" },
] as const;

const variants = ["", ". Please listen", ". What should I do?", ". I need one small next step"];
const corpus = situations.flatMap((situation) =>
  (["en", "hi", "hg"] as const).flatMap((language) =>
    variants.map((suffix, variant) => ({
      id: `${situation.theme}-${language}-${variant}`,
      message: `${situation[language]}${suffix}`,
      expectedSafety: situation.safety,
    })),
  ),
);

describe("expert-system evaluation corpus", () => {
  it("contains at least 100 multilingual scenarios", () => {
    expect(corpus.length).toBeGreaterThanOrEqual(100);
    expect(new Set(corpus.map((item) => item.id)).size).toBe(corpus.length);
  });

  it.each(corpus)("classifies safety consistently: $id", ({ message, expectedSafety }) => {
    expect(assessSafetyText(message)).toBe(expectedSafety);
  });

  it.each(corpus)("always produces a bounded response plan: $id", ({ message }) => {
    const safetyTier = assessSafetyText(message);
    const plan = planResponse({ message, stage: /what should|kya karu|next step/i.test(message) ? "SOLVE" : "EXPLORE", safetyTier, recentQuestions: 0 });
    expect(plan.questionCount).toBeLessThanOrEqual(1);
    expect(plan.actionCount).toBeGreaterThanOrEqual(0);
    expect(plan.avoid).toContain("diagnosis");
    if (safetyTier === "urgent") expect(plan.goal).toBe("stabilize");
  });
});
