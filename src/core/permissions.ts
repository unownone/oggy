import type { ReplayStep, ToolRecipe } from "./index";

export type PermissionStatus = "pending" | "approved" | "denied";

export type PermissionDecision = "approved" | "denied";

export interface ToolPatch {
  name?: string;
  title?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Partial<ToolRecipe["annotations"]>;
  steps?: ReplayStep[];
}

export interface ToolUpdateProposal {
  id: string;
  origin: string;
  toolName: string;
  reason: string;
  patch: ToolPatch;
  status: PermissionStatus;
  createdAt: string;
  resolvedAt?: string;
}

/**
 * Agent-facing entry: always pending. Never writes a tool.
 */
export function proposeToolUpdate(input: {
  origin: string;
  toolName: string;
  reason: string;
  patch: ToolPatch;
  id?: string;
  createdAt?: string;
}): ToolUpdateProposal {
  return {
    id: input.id ?? crypto.randomUUID(),
    origin: input.origin,
    toolName: input.toolName,
    reason: input.reason,
    patch: input.patch,
    status: "pending",
    createdAt: input.createdAt ?? new Date().toISOString(),
  };
}

export function resolveToolUpdate(
  proposal: ToolUpdateProposal,
  decision: PermissionDecision,
  resolvedAt?: string,
): ToolUpdateProposal {
  if (proposal.status !== "pending") {
    return proposal;
  }
  return {
    ...proposal,
    status: decision,
    resolvedAt: resolvedAt ?? new Date().toISOString(),
  };
}

/**
 * The only function allowed to mutate a tool recipe from an agent patch.
 * Throws unless the user already approved.
 */
export function applyApprovedPatch(
  tool: ToolRecipe,
  proposal: ToolUpdateProposal,
): ToolRecipe {
  if (proposal.status !== "approved") {
    throw new Error(
      "Refusing to mutate tool without approved user permission",
    );
  }
  if (proposal.toolName !== tool.name && !proposal.patch.name) {
    throw new Error(
      `Proposal targets "${proposal.toolName}" but tool is "${tool.name}"`,
    );
  }

  const patch = proposal.patch;
  return {
    ...tool,
    name: patch.name ?? tool.name,
    title: patch.title ?? tool.title,
    description: patch.description ?? tool.description,
    inputSchema: patch.inputSchema ?? tool.inputSchema,
    annotations: patch.annotations
      ? { ...tool.annotations, ...patch.annotations }
      : tool.annotations,
    steps: patch.steps ?? tool.steps,
  };
}

export function applyOverlayToTool(
  tool: ToolRecipe,
  overlay: ToolPatch,
): ToolRecipe {
  return {
    ...tool,
    name: overlay.name ?? tool.name,
    title: overlay.title ?? tool.title,
    description: overlay.description ?? tool.description,
    inputSchema: overlay.inputSchema ?? tool.inputSchema,
    annotations: overlay.annotations
      ? { ...tool.annotations, ...overlay.annotations }
      : tool.annotations,
    steps: overlay.steps ?? tool.steps,
  };
}
