import type { DomainMcp, ToolRecipe } from "./index";
import type { LoadCriteria } from "./load-criteria";
import type { ToolLayer } from "./tool-names";

/**
 * Attachable MCP unit. DomainMcp is what registerRecipes already consumes;
 * this wrapper adds layer + loadCriteria + a stable id for diffing.
 */
export interface McpManifest {
  id: string;
  layer: ToolLayer;
  title: string;
  version: number;
  loadCriteria: LoadCriteria;
  tools: ToolRecipe[];
  skillsSnapshot?: SkillSnapshot[];
}

export interface SkillSnapshot {
  id: string;
  name: string;
  description: string;
}

export interface AttachmentTarget {
  id: string;
  layer: ToolLayer;
  fingerprint: string;
  mcp: DomainMcp;
}

export type AttachmentState = Record<string, { fingerprint: string }>;

export interface AttachPlan {
  attach: AttachmentTarget[];
  detach: string[];
  unchanged: string[];
}

export function manifestToDomainMcp(manifest: McpManifest): DomainMcp {
  return {
    id: manifest.id,
    version: manifest.version,
    synthesizedAt: synthesizedAtForLayer(manifest.layer),
    tools: manifest.tools,
    layer: manifest.layer,
    loadCriteria: manifest.loadCriteria,
    skillsSnapshot: manifest.skillsSnapshot,
  };
}

export function learnedToManifest(
  mcp: DomainMcp,
  origin: string,
): McpManifest {
  return {
    id: mcp.id,
    layer: mcp.layer ?? "learned",
    title: "Learned origin tools",
    version: mcp.version,
    loadCriteria: mcp.loadCriteria ?? {
      all: [{ type: "origin", origin }],
    },
    tools: mcp.tools,
    skillsSnapshot: mcp.skillsSnapshot,
  };
}

export function fingerprintMcp(mcp: Pick<DomainMcp, "id" | "version" | "tools" | "skillsSnapshot">): string {
  const tools = [...mcp.tools]
    .map((t) => toolFingerprint(t))
    .sort();
  const skills = (mcp.skillsSnapshot ?? [])
    .map((s) => s.id)
    .sort()
    .join(",");
  return `${mcp.id}@${mcp.version}[${tools.join("|")}]#${skills}`;
}

export function fingerprintManifest(manifest: McpManifest): string {
  return fingerprintMcp(manifestToDomainMcp(manifest));
}

function toolFingerprint(tool: ToolRecipe): string {
  const impl =
    tool.implementation?.kind === "builtin"
      ? tool.implementation.handler
      : tool.implementation?.kind === "composite"
        ? tool.implementation.uses.join(",")
        : "recipe";
  return `${tool.name}:${tool.steps.length}:${impl}:${stableJson(tool.inputSchema)}:${tool.description}`;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJson(obj[k])}`).join(",")}}`;
}

function synthesizedAtForLayer(layer: ToolLayer): string {
  switch (layer) {
    case "primitive":
    case "domain":
    case "meta":
      return "builtin";
    case "learned":
      return "learned";
    default: {
      const _exhaustive: never = layer;
      throw new Error(`Unhandled layer: ${_exhaustive}`);
    }
  }
}
