import { describe, expect, it } from "vitest";
import {
  assessSafetyText,
  buildUrgentSafetyReply,
  detectLanguageStyle,
} from "../../supabase/functions/_shared/safety";

describe("mental-health safety layer", () => {
  it.each([
    "I want to kill myself",
    "I don't want to live anymore",
    "mujhe jeena nahi chahta",
    "I am planning to overdose",
  ])("classifies explicit self-harm language as urgent: %s", (message) => {
    expect(assessSafetyText(message)).toBe("urgent");
  });

  it.each([
    "I feel hopeless today",
    "I feel worthless after the result",
    "I have suicidal thoughts but no plan or intent",
  ])("keeps distress or explicitly negated intent at concern: %s", (message) => {
    expect(assessSafetyText(message)).toBe("concern");
  });

  it("does not treat ordinary distress as a crisis", () => {
    expect(assessSafetyText("My exam was terrible and I feel stressed")).toBe("none");
  });

  it("mirrors English, Hindi and Hinglish crisis replies", () => {
    expect(detectLanguageStyle("I need help")).toBe("english");
    expect(detectLanguageStyle("मैं बहुत परेशान हूँ")).toBe("hindi");
    expect(detectLanguageStyle("yaar mujhe help chahiye")).toBe("hinglish");
  });

  it("always includes a direct safety check, human connection and official support", () => {
    const reply = buildUrgentSafetyReply("I want to end my life");
    expect(reply).toMatch(/immediate danger/i);
    expect(reply).toMatch(/trusted person/i);
    expect(reply).toContain("14416");
    expect(reply).toContain("1800-89-14416");
  });
});
