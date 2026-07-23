import { describe, expect, it } from "vitest";
import { analyticsCatalog, metricById } from "./catalog";

describe("analytics catalog", () => {
  it("exposes metrics with valid dimension references", () => {
    const cat = analyticsCatalog();
    expect(cat.metrics.length).toBeGreaterThan(15);
    const dimIds = new Set(cat.dimensions.map((d) => d.id));
    for (const m of cat.metrics) {
      for (const d of m.dimensions) {
        expect(dimIds.has(d), `${m.id} references unknown dimension ${d}`).toBe(true);
      }
    }
  });

  it("every rate metric points at real numerator/denominator metrics", () => {
    const internal = new Set(["appointments_completed", "appointments_held"]);
    for (const m of analyticsCatalog().metrics) {
      const def = metricById(m.id)!;
      if (def.agg === "rate") {
        const { numerator, denominator } = def.rate!;
        expect(metricById(numerator) || internal.has(numerator)).toBeTruthy();
        expect(metricById(denominator) || internal.has(denominator)).toBeTruthy();
      }
    }
  });
});
