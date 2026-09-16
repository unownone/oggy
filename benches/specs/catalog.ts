import { amazonFixture } from "./amazon.fixture";
import { amazonLive } from "./amazon.live";
import { googleFixture } from "./google.fixture";
import { googleLive } from "./google.live";
import { xFixture } from "./x.fixture";
import { xLive } from "./x.live";
import type { BenchKind, BenchSpec } from "./types";

export const ALL_SPECS: BenchSpec[] = [
  googleFixture,
  amazonFixture,
  xFixture,
  googleLive,
  amazonLive,
  xLive,
];

export function listSpecs(kind?: BenchKind): BenchSpec[] {
  return kind ? ALL_SPECS.filter((s) => s.kind === kind) : ALL_SPECS;
}

export function resolveSpecs(ids: string[], includeLive: boolean): BenchSpec[] {
  if (ids.length === 0) {
    return includeLive
      ? ALL_SPECS
      : ALL_SPECS.filter((s) => s.kind === "fixture");
  }
  const wanted = new Set(ids);
  const resolved = ALL_SPECS.filter((s) => wanted.has(s.id));
  const missing = ids.filter((id) => !ALL_SPECS.some((s) => s.id === id));
  if (missing.length > 0) {
    const known = ALL_SPECS.map((s) => s.id).join(", ");
    throw new Error(`Unknown spec(s): ${missing.join(", ")}. Known: ${known}`);
  }
  return resolved;
}
