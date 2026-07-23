import { afterEach, describe, expect, it } from "vitest";
import { isPlatformAdmin } from "./admin";

afterEach(() => {
  delete process.env.PLATFORM_ADMIN_EMAILS;
});

describe("isPlatformAdmin", () => {
  it("matches the default admin email, case-insensitively", () => {
    expect(isPlatformAdmin("keltruelove42@gmail.com")).toBe(true);
    expect(isPlatformAdmin("KelTrueLove42@Gmail.com")).toBe(true);
  });

  it("rejects other emails and empty values", () => {
    expect(isPlatformAdmin("someone@else.com")).toBe(false);
    expect(isPlatformAdmin("")).toBe(false);
    expect(isPlatformAdmin(null)).toBe(false);
  });

  it("honors the PLATFORM_ADMIN_EMAILS override", () => {
    process.env.PLATFORM_ADMIN_EMAILS = "a@x.com, b@y.com";
    expect(isPlatformAdmin("b@y.com")).toBe(true);
    expect(isPlatformAdmin("keltruelove42@gmail.com")).toBe(false);
  });
});
