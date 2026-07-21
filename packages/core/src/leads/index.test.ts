import { describe, expect, it } from "vitest";
import { normalizeEmail, firstName, previewEmailBody } from "./index";

describe("leads helpers", () => {
  it("normalizes email", () => {
    expect(normalizeEmail("  Maya.T@Gmail.com ")).toBe("maya.t@gmail.com");
    expect(normalizeEmail("")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("extracts first name", () => {
    expect(firstName("Maya Thompson")).toBe("Maya");
    expect(firstName("Jordan & Casey Lee")).toBe("Jordan");
  });

  it("renders merge tags in preview", () => {
    const out = previewEmailBody("Hi {{first_name}} — {{property}} awaits", {
      name: "Maya Thompson",
      property: "Blue Ridge Lakehouse",
    });
    expect(out).toBe("Hi Maya — Blue Ridge Lakehouse awaits");
  });
});
