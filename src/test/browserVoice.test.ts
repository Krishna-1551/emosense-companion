import { describe, it, expect } from "vitest";
import { splitUtterances, detectLang } from "@/lib/browserVoice";

describe("browser voice helpers", () => {
  it("splits long replies into utterances of at most 200 characters", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Sentence number ${i} is here.`).join(" ");
    const parts = splitUtterances(long);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every(p => p.length <= 200)).toBe(true);
    expect(parts.join(" ").replace(/\s+/g, " ")).toBe(long);
  });
  it("uses a Hindi voice for Devanagari text", () => {
    expect(detectLang("मैं ठीक हूँ", "en-IN")).toBe("hi-IN");
    expect(detectLang("I am okay", "en-IN")).toBe("en-IN");
  });
});
