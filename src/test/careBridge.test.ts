import { describe, it, expect } from "vitest";
import { assessSupportLevel, VERIFIED_HELPLINES, telHref, buildSupportPlan, detectCareLang } from "@/lib/careBridge";

const u = (content: string, emotion?: string, risk?: string) =>
  ({ role: "user" as const, content, emotion, risk_level: risk });

describe("Care Bridge level detection", () => {
  it("Scenario 1 — exam stress → Level 1", () => {
    const a = assessSupportLevel([u("I am stressed about my examination tomorrow.", "stress", "low")]);
    expect(a.level).toBe(1);
    expect(a.riskBand).toBe("low");
  });

  it("Scenario 2 — repeated hopelessness → Level 2", () => {
    const a = assessSupportLevel([
      u("I feel alone lately", "loneliness", "moderate"),
      u("nothing is working out", "sadness", "moderate"),
      u("For many days I have been feeling hopeless and alone.", "sadness", "moderate"),
    ]);
    expect(a.level).toBe(2);
    expect(a.reasons).toContain("hopelessness_language");
  });

  it("Scenario 3 — synthetic immediate-danger phrase → Level 3", () => {
    const a = assessSupportLevel([u("emosense_test_immediate_danger", "sadness", "high")]);
    expect(a.level).toBe(3);
    expect(a.riskBand).toBe("high");
  });

  it("neutral chat stays at Level 0", () => {
    expect(assessSupportLevel([u("I watched a good film today", "joy", "low")]).level).toBe(0);
  });

  it("verified helplines are controlled constants with tel links", () => {
    expect(VERIFIED_HELPLINES.map(h => h.number)).toEqual(["14416", "1800-89-14416", "112"]);
    expect(telHref("1800-89-14416")).toBe("tel:18008914416");
  });

  it("support plans are deterministic and offline-safe", () => {
    expect(buildSupportPlan("anxiety").activity.steps.length).toBeGreaterThan(2);
    expect(buildSupportPlan("unknown-emotion").activity.title).toBeTruthy();
  });

  it("mirrors Hindi and Hinglish", () => {
    expect(detectCareLang([u("मुझे बहुत तनाव है")])).toBe("hi");
    expect(detectCareLang([u("mujhe bahut tension hai yaar")])).toBe("hi");
    expect(detectCareLang([u("I am fine")])).toBe("en");
  });
});
