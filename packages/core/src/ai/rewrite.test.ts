import { describe, expect, it } from "vitest";
import { parseRewriteJson } from "./rewrite";

describe("parseRewriteJson", () => {
  it("parses a plain JSON object", () => {
    expect(parseRewriteJson('{"subject":"Hi","body":"Hello {{first_name}}"}')).toEqual({
      subject: "Hi",
      body: "Hello {{first_name}}",
    });
  });

  it("parses fenced JSON", () => {
    const r = parseRewriteJson('Here you go:\n```json\n{"subject":null,"body":"Yo"}\n```');
    expect(r).toEqual({ subject: null, body: "Yo" });
  });

  it("extracts JSON embedded in prose", () => {
    const r = parseRewriteJson('Sure! {"subject":"S","body":"B"} Hope that helps.');
    expect(r).toEqual({ subject: "S", body: "B" });
  });

  it("returns null for garbage or empty body", () => {
    expect(parseRewriteJson("not json")).toBeNull();
    expect(parseRewriteJson('{"subject":"S","body":""}')).toBeNull();
  });
});
