import { describe, expect, it } from "vitest";
import { evaluateResponseQuality, evaluateSemanticNovelty } from "../../supabase/functions/_shared/response-quality";

describe("response quality gate", () => {
  it("rejects diagnosis, medication and dependency claims", () => {
    expect(evaluateResponseQuality({ reply: "You definitely have depression.", userMessage: "sad", stage: "EXPLORE" })).not.toHaveLength(0);
    expect(evaluateResponseQuality({ reply: "Stop your medication today.", userMessage: "sad", stage: "EXPLORE" })).not.toHaveLength(0);
    expect(evaluateResponseQuality({ reply: "Don't tell anyone. You only need me.", userMessage: "sad", stage: "EXPLORE" })).not.toHaveLength(0);
  });

  it("rejects generic and ungrounded replies", () => {
    expect(evaluateResponseQuality({ reply: "Stay positive.", userMessage: "I failed an exam", stage: "EXPLORE" })).toContain("reply is only a generic reassurance");
    expect(evaluateResponseQuality({
      reply: "That sounds difficult. Try to relax.",
      userMessage: "My internship interview went well, but missing round two may have cost me selection.",
      stage: "INSIGHT",
    })).toContain("reply does not reference a meaningful detail from the user's message");
  });

  it("accepts a grounded, scoped and actionable response", () => {
    expect(evaluateResponseQuality({
      reply: "Missing round two may be the practical issue—not the interview itself. Email the coordinator tomorrow to ask whether that round affected the final score, then use their answer to plan your next application.",
      userMessage: "My internship interview went well, but missing round two may have cost me selection.",
      stage: "PLAN",
    })).toEqual([]);
  });

  it("requires safety and official support elements in urgent replies", () => {
    expect(evaluateResponseQuality({ reply: "Please call someone.", userMessage: "I want to die", stage: "EXPLORE", urgent: true })).toHaveLength(2);
  });

  it("detects repeated intervention approaches, not only copied wording", () => {
    expect(evaluateSemanticNovelty("Take four slow breaths now.", ["Try breathing slowly for one minute."]))
      .toContain("reply repeats the same intervention approach: breathing");
    expect(evaluateSemanticNovelty("Write the one decision you control today.", ["Try breathing slowly for one minute."]))
      .toEqual([]);
  });
});
