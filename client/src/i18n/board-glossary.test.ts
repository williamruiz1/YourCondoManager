// founder-os#9487 — Board-mode plain-English glossary.
import { describe, expect, it } from "vitest";
import { plainLabel, BOARD_GLOSSARY } from "./board-glossary";

describe("plainLabel — jargon → plain English on the Board surface", () => {
  it("replaces accounting jargon with plain English when on the Board surface", () => {
    expect(plainLabel("AR Aging", true)).toBe("Money owed by owners");
    expect(plainLabel("Assessment", true)).toBe("Owner charge");
    expect(plainLabel("Work Order", true)).toBe("Repair job");
    expect(plainLabel("Vendor", true)).toBe("Contractor");
    expect(plainLabel("Governance Meeting", true)).toBe("Board meeting");
  });

  it("restores the technical term when NOT on the Board surface (advanced view)", () => {
    expect(plainLabel("AR Aging", false)).toBe("AR Aging");
    expect(plainLabel("Assessment", false)).toBe("Assessment");
    expect(plainLabel("Work Order", false)).toBe("Work Order");
  });

  it("passes unknown terms through unchanged in both modes", () => {
    expect(plainLabel("Cherry Hill Court", true)).toBe("Cherry Hill Court");
    expect(plainLabel("Cherry Hill Court", false)).toBe("Cherry Hill Court");
  });

  it("every glossary value is genuinely different from its jargon key", () => {
    for (const [term, plain] of Object.entries(BOARD_GLOSSARY)) {
      expect(plain).not.toBe(term);
      expect(plain.length).toBeGreaterThan(0);
    }
  });
});
