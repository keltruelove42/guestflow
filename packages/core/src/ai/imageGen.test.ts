import { describe, expect, it } from "vitest";
import { canGenerateImages } from "./imageGen";

describe("canGenerateImages (plan gate)", () => {
  it("allows growth and enterprise only", () => {
    expect(canGenerateImages("GROWTH")).toBe(true);
    expect(canGenerateImages("ENTERPRISE")).toBe(true);
  });

  it("blocks trial, starter, and unknown plans", () => {
    expect(canGenerateImages("TRIAL")).toBe(false);
    expect(canGenerateImages("STARTER")).toBe(false);
    expect(canGenerateImages("")).toBe(false);
    expect(canGenerateImages("growth")).toBe(false);
  });
});
