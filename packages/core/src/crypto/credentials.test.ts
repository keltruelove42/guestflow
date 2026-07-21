import { createHash } from "crypto";
import { describe, expect, it } from "vitest";
import { decryptJson, encryptJson } from "./credentials";

describe("credentials crypto", () => {
  it("round-trips JSON", () => {
    process.env.CREDENTIALS_KEY = createHash("sha256").update("test-key").digest("hex");
    const payload = { apiKey: "secret", nested: { a: 1 } };
    const blob = encryptJson(payload);
    expect(blob.v).toBe(1);
    expect(blob.data).not.toContain("secret");
    expect(decryptJson(blob)).toEqual(payload);
  });

  it("accepts plain objects for back-compat", () => {
    process.env.CREDENTIALS_KEY = createHash("sha256").update("test-key").digest("hex");
    expect(decryptJson({ accountSid: "AC123" })).toEqual({ accountSid: "AC123" });
  });
});
