import { describe, it, expect } from "vitest";
import { parseArgs } from "./args";
import { resolveSpecs } from "../specs/catalog";
import { classifyTools, argsForQuery, type StoredTool } from "./replay";
import { finalizeReport, finalizeSpec } from "./report";

describe("parseArgs", () => {
  it("defaults to headed fixtures-only", () => {
    const args = parseArgs([]);
    expect(args.live).toBe(false);
    expect(args.headed).toBe(true);
    expect(args.specIds).toEqual([]);
  });

  it("parses --live --headless --fail-under and spec ids", () => {
    const args = parseArgs([
      "--live",
      "--headless",
      "--fail-under",
      "0.25",
      "google-fixture",
    ]);
    expect(args.live).toBe(true);
    expect(args.headed).toBe(false);
    expect(args.failUnder).toBe(0.25);
    expect(args.specIds).toEqual(["google-fixture"]);
  });

  it("rejects unknown flags", () => {
    expect(() => parseArgs(["--nope"])).toThrow(/Unknown flag/);
  });
});

describe("resolveSpecs", () => {
  it("lists fixture specs by default", () => {
    const specs = resolveSpecs([], false);
    expect(specs.every((s) => s.kind === "fixture")).toBe(true);
    expect(specs.map((s) => s.id)).toEqual([
      "google-fixture",
      "amazon-fixture",
      "x-fixture",
    ]);
  });

  it("includes live specs with --live", () => {
    const ids = resolveSpecs([], true).map((s) => s.id);
    expect(ids).toContain("google-live");
    expect(ids).toContain("amazon-live");
    expect(ids).toContain("x-live");
  });

  it("allows explicitly named live specs without --live", () => {
    const ids = resolveSpecs(["google-live"], false).map((s) => s.id);
    expect(ids).toEqual(["google-live"]);
  });
});

describe("classifyTools", () => {
  const search: StoredTool = {
    name: "q",
    description: "search",
    inputSchema: { type: "object", properties: { q: { type: "string" } } },
    steps: [{ type: "fill" }, { type: "submit" }, { type: "click" }],
  };

  it("treats a fill+click recipe as both search and click", () => {
    const classified = classifyTools([search]);
    expect(classified.search?.name).toBe("q");
    expect(classified.click?.name).toBe("q");
  });

  it("maps the first schema property to the variant query", () => {
    expect(argsForQuery(search, "playwright")).toEqual({ q: "playwright" });
  });
});

describe("report totals", () => {
  it("computes pass rate across variants", () => {
    const spec = finalizeSpec({
      id: "google-fixture",
      kind: "fixture",
      title: "t",
      site: "s",
      toolsLoaded: true,
      tools: [],
      variants: [
        { id: "a", query: "a", ok: true, detail: "ok" },
        { id: "b", query: "b", ok: false, detail: "fail" },
      ],
    });
    expect(spec.passRate).toBe(0.5);
    const report = finalizeReport("2026-01-01T00:00:00Z", false, [spec]);
    expect(report.totals.passed).toBe(1);
    expect(report.totals.failed).toBe(1);
    expect(report.totals.passRate).toBe(0.5);
  });
});
