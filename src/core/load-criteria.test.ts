import { describe, it, expect } from "vitest";
import { matchLoadCriteria, hostMatchesSuffix } from "@/core/load-criteria";
import { pageContextFromLocation } from "@/core/page-context";

function page(href: string, extra?: { title?: string; recordingActive?: boolean }) {
  return pageContextFromLocation({ href, ...extra });
}

describe("hostMatchesSuffix", () => {
  it("matches exact host and www subdomain", () => {
    expect(hostMatchesSuffix("amazon.com", "amazon.com")).toBe(true);
    expect(hostMatchesSuffix("www.amazon.com", "amazon.com")).toBe(true);
    expect(hostMatchesSuffix("smile.amazon.com", "amazon.com")).toBe(true);
  });

  it("does not match a different registrable domain", () => {
    expect(hostMatchesSuffix("notamazon.com", "amazon.com")).toBe(false);
    expect(hostMatchesSuffix("amazon.com.evil.example", "amazon.com")).toBe(false);
  });
});

describe("matchLoadCriteria", () => {
  const amazon = page("https://www.amazon.com/s?k=shoes#results");

  it("empty criteria matches everything", () => {
    expect(matchLoadCriteria({}, amazon)).toBe(true);
    expect(matchLoadCriteria(undefined, amazon)).toBe(true);
  });

  it("all predicates are AND", () => {
    expect(
      matchLoadCriteria(
        {
          all: [
            { type: "hostSuffix", value: "amazon.com" },
            { type: "pathPrefix", value: "/s" },
          ],
        },
        amazon,
      ),
    ).toBe(true);
    expect(
      matchLoadCriteria(
        {
          all: [
            { type: "hostSuffix", value: "amazon.com" },
            { type: "pathPrefix", value: "/gp/cart" },
          ],
        },
        amazon,
      ),
    ).toBe(false);
  });

  it("any predicates are OR", () => {
    expect(
      matchLoadCriteria(
        {
          any: [
            { type: "pathPrefix", value: "/gp/cart" },
            { type: "hashIncludes", value: "results" },
          ],
        },
        amazon,
      ),
    ).toBe(true);
  });

  it("origin is scheme+host+port exact", () => {
    expect(
      matchLoadCriteria({ all: [{ type: "origin", origin: "https://www.amazon.com" }] }, amazon),
    ).toBe(true);
    expect(
      matchLoadCriteria({ all: [{ type: "origin", origin: "http://www.amazon.com" }] }, amazon),
    ).toBe(false);
  });

  it("pathPattern uses regexp against pathname", () => {
    expect(
      matchLoadCriteria({ all: [{ type: "pathPattern", source: "^/s" }] }, amazon),
    ).toBe(true);
    expect(
      matchLoadCriteria({ all: [{ type: "pathPattern", source: "(" }] }, amazon),
    ).toBe(false);
  });

  it("recording predicate follows PageContext", () => {
    expect(
      matchLoadCriteria({ all: [{ type: "recording", active: true }] }, amazon),
    ).toBe(false);
    expect(
      matchLoadCriteria(
        { all: [{ type: "recording", active: true }] },
        page("https://www.amazon.com/", { recordingActive: true }),
      ),
    ).toBe(true);
  });
});
