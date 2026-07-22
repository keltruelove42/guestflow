import { describe, expect, it } from "vitest";
import { renderMessage } from "./render";

describe("custom org variables", () => {
  it("renders custom + business variables and blanks unknown tags", () => {
    const out = renderMessage({
      template:
        "Hi {{first_name}}, use code {{discount_code}} at {{business_name}}. {{missing_tag}} Book: {{quote_link}}",
      channel: "SMS",
      leadName: "Renee Castillo",
      unsubLink: "http://x/unsub",
      quoteLink: "http://book.example",
      orgVariables: { discount_code: "SUMMER500", business_name: "Coda Motors" },
    });
    expect(out.body).toContain("Hi Renee, use code SUMMER500 at Coda Motors.");
    expect(out.body).not.toContain("{{");
    expect(out.body).toContain("http://book.example");
  });
});
