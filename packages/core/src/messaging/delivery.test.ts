import { describe, expect, it, afterEach } from "vitest";
import { wantsLiveDelivery } from "../integrations";

describe("wantsLiveDelivery", () => {
  const prev = process.env.SEND_MODE;

  afterEach(() => {
    if (prev === undefined) delete process.env.SEND_MODE;
    else process.env.SEND_MODE = prev;
  });

  it("uses LIVE org mode by default", () => {
    delete process.env.SEND_MODE;
    expect(wantsLiveDelivery("LIVE")).toBe(true);
    expect(wantsLiveDelivery("DEMO")).toBe(false);
  });

  it("SEND_MODE=live overrides DEMO", () => {
    process.env.SEND_MODE = "live";
    expect(wantsLiveDelivery("DEMO")).toBe(true);
  });

  it("SEND_MODE=log overrides LIVE", () => {
    process.env.SEND_MODE = "log";
    expect(wantsLiveDelivery("LIVE")).toBe(false);
  });
});
