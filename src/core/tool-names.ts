// ---------------------------------------------------------------------------
// Stable tool names, layers, and timing constants.
// Value module — no imports from ./index (avoids cycles).
// ---------------------------------------------------------------------------

/** SPA / history-only navigations are re-evaluated on this interval. */
export const SPA_REFRESH_MS = 500;

export const PRIMITIVE_KINDS = [
  "click",
  "scroll",
  "move",
  "slide",
  "input",
  "output",
  "read",
] as const;

export type PrimitiveKind = (typeof PRIMITIVE_KINDS)[number];

export const DOMAIN_TOOL_NAMES = [
  "find_listing",
  "click_object",
  "sign_up",
  "login",
  "add_to_cart",
] as const;

export type DomainToolName = (typeof DOMAIN_TOOL_NAMES)[number];

export const UPDATE_TOOL_NAME = "oggy_update_tool";
export const LIST_SKILLS_TOOL_NAME = "oggy_list_skills";

export const MCP_ID = {
  primitives: "oggy.builtin.primitives",
  commerceAmazon: "oggy.builtin.commerce.amazon",
  meta: "oggy.builtin.meta",
} as const;

export const TOOL_LAYERS = [
  "primitive",
  "domain",
  "learned",
  "meta",
] as const;

export type ToolLayer = (typeof TOOL_LAYERS)[number];

export const BUILTIN_HANDLER_IDS = [
  ...PRIMITIVE_KINDS,
  ...DOMAIN_TOOL_NAMES,
  UPDATE_TOOL_NAME,
  LIST_SKILLS_TOOL_NAME,
] as const;

export type BuiltinHandlerId = (typeof BUILTIN_HANDLER_IDS)[number];

export function isPrimitiveKind(value: string): value is PrimitiveKind {
  return (PRIMITIVE_KINDS as readonly string[]).includes(value);
}

export function isDomainToolName(value: string): value is DomainToolName {
  return (DOMAIN_TOOL_NAMES as readonly string[]).includes(value);
}

export function isPermissionedTool(name: string): boolean {
  return name === UPDATE_TOOL_NAME;
}
