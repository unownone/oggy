import type { ToolRecipe } from "@/core";
import type { McpManifest } from "@/core/mcp-manifest";
import {
  LIST_SKILLS_TOOL_NAME,
  MCP_ID,
  PRIMITIVE_KINDS,
  UPDATE_TOOL_NAME,
  type PrimitiveKind,
} from "@/core/tool-names";
import { amazonCommerceManifest } from "./commerce";

const readOnly = {
  readOnlyHint: true,
  consequentialHint: false,
  untrustedContentHint: false,
} as const;

const writeAnno = {
  readOnlyHint: false,
  consequentialHint: false,
  untrustedContentHint: false,
} as const;

const consequential = {
  readOnlyHint: false,
  consequentialHint: true,
  untrustedContentHint: false,
} as const;

function primitiveRecipe(kind: PrimitiveKind): ToolRecipe {
  const observational = kind === "read" || kind === "output";
  return {
    name: kind,
    title: kind,
    description: primitiveDescription(kind),
    inputSchema: primitiveSchema(kind),
    annotations: observational ? readOnly : writeAnno,
    steps: [],
    layer: "primitive",
    implementation: { kind: "builtin", handler: kind },
  };
}

function primitiveDescription(kind: PrimitiveKind): string {
  switch (kind) {
    case "click":
      return "Click an interactive element. Primitive recording/replay action.";
    case "scroll":
      return "Scroll a target into view, or the page by deltaX/deltaY.";
    case "move":
      return "Move the pointer over a target (hover).";
    case "slide":
      return "Drag/slide from one point to another on a target.";
    case "input":
      return "Fill an input, textarea, or select. Sensitive values are never stored.";
    case "output":
      return "Read visible page output (text, URL, listing results) and return it.";
    case "read":
      return "Read a field or element when a value is required but missing.";
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled primitive: ${_exhaustive}`);
    }
  }
}

function primitiveSchema(kind: PrimitiveKind): Record<string, unknown> {
  switch (kind) {
    case "click":
    case "move":
    case "read":
      return {
        type: "object",
        properties: {
          object: { type: "string", description: "Accessible name, text, or CSS/testid" },
          index: { type: "number" },
        },
      };
    case "scroll":
      return {
        type: "object",
        properties: {
          object: { type: "string" },
          deltaX: { type: "number" },
          deltaY: { type: "number" },
        },
      };
    case "slide":
      return {
        type: "object",
        properties: {
          object: { type: "string" },
          fromX: { type: "number" },
          fromY: { type: "number" },
          toX: { type: "number" },
          toY: { type: "number" },
        },
      };
    case "input":
      return {
        type: "object",
        properties: {
          object: { type: "string" },
          value: { type: "string" },
          fieldName: { type: "string" },
        },
        required: ["value"],
      };
    case "output":
      return {
        type: "object",
        properties: {
          object: { type: "string" },
        },
      };
    default: {
      const _exhaustive: never = kind;
      throw new Error(`Unhandled primitive: ${_exhaustive}`);
    }
  }
}

export const primitivesManifest: McpManifest = {
  id: MCP_ID.primitives,
  layer: "primitive",
  title: "Recording primitives",
  version: 1,
  loadCriteria: { all: [{ type: "recording", active: true }] },
  tools: PRIMITIVE_KINDS.map(primitiveRecipe),
};

export const metaManifest: McpManifest = {
  id: MCP_ID.meta,
  layer: "meta",
  title: "Oggy meta tools",
  version: 1,
  loadCriteria: {
    any: [{ type: "recording", active: true }, { type: "always" }],
  },
  tools: [
    {
      name: UPDATE_TOOL_NAME,
      title: "Update tool",
      description:
        "Propose an update to a tool the agent has learned is invalid or stale. Does not mutate until the user approves in the Oggy side panel.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string" },
          reason: { type: "string" },
          patch: {
            type: "object",
            description: "Partial ToolRecipe: description, inputSchema, steps, title, name",
          },
        },
        required: ["toolName", "reason"],
      },
      annotations: consequential,
      steps: [],
      layer: "meta",
      implementation: { kind: "builtin", handler: UPDATE_TOOL_NAME },
    },
    {
      name: LIST_SKILLS_TOOL_NAME,
      title: "List skills",
      description:
        "Read-only skill context for this origin: named flows the user saved after recording.",
      inputSchema: { type: "object", properties: {} },
      annotations: readOnly,
      steps: [],
      layer: "meta",
      implementation: { kind: "builtin", handler: LIST_SKILLS_TOOL_NAME },
    },
  ],
};

export const BUILTIN_MCP_CATALOG: McpManifest[] = [
  primitivesManifest,
  amazonCommerceManifest,
  metaManifest,
];
