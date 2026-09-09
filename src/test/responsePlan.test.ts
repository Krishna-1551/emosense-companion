import { describe, expect, it } from "vitest";
import { planResponse } from "../../supabase/functions/_shared/response-plan";

describe("response planner", () => {
  it("routes explicit requests to action without another question", () => {
    const plan = planResponse({ message: "Seedha solution batao, kya karu?", stage: "SOLVE", safetyTier: "none", recentQuestions: 0 });
    expect(plan.goal).toBe("solve");
    expect(plan.actionCount).toBe(3);
    expect(plan.questionCount).toBe(0);
  });

  it("does not rush venting into advice", () => {
    const plan = planResponse({ message: "I am so frustrated with my boss", stage: "EXPLORE", safetyTier: "none", recentQuestions: 0 });
    expect(plan.goal).toBe("vent");
    expect(plan.actionCount).toBe(0);
  });

  it("always routes urgent language to stabilization", () => {
    const plan = planResponse({ message: "I want to die", stage: "EXPLORE", safetyTier: "urgent", recentQuestions: 0 });
    expect(plan.goal).toBe("stabilize");
    expect(plan.technique).toMatch(/safety/i);
  });
});
