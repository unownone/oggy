import {
  isRecordableHref,
  type OriginBundle,
  type ToolRecipe,
} from "@/core";
import {
  fingerprintManifest,
  learnedToManifest,
  manifestToDomainMcp,
  type AttachmentTarget,
  type McpManifest,
} from "@/core/mcp-manifest";
import { matchLoadCriteria } from "@/core/load-criteria";
import { applyOverlayToTool, type ToolPatch } from "@/core/permissions";
import { LIST_SKILLS_TOOL_NAME, MCP_ID } from "@/core/tool-names";
import type { PageContext } from "@/core/page-context";

/**
 * Decide which MCPs should be on document.modelContext for this page.
 * Pure. Chrome-free.
 */
export function evaluateAttachments(input: {
  page: PageContext;
  bundle: OriginBundle | null;
  catalog: McpManifest[];
}): AttachmentTarget[] {
  const { page, bundle, catalog } = input;

  if (!isRecordableHref(page.href) && !isRecordableHref(page.origin)) {
    return [];
  }

  const enabled = bundle?.enabled ?? true;
  if (!enabled && !page.recordingActive) {
    return [];
  }

  const selected: McpManifest[] = [];

  for (const manifest of catalog) {
    if (manifest.id === MCP_ID.meta) continue;
    if (!matchLoadCriteria(manifest.loadCriteria, page)) continue;
    selected.push(manifest);
  }

  if (enabled && bundle?.mcp && bundle.mcp.tools.length > 0) {
    selected.push(learnedToManifest(bundle.mcp, page.origin));
  }

  const overlays = bundle?.toolOverlays ?? {};
  const withOverlays = selected.map((m) => applyOverlays(m, overlays));

  const attachMeta =
    page.recordingActive || withOverlays.some((m) => m.tools.length > 0);
  if (attachMeta) {
    const meta = catalog.find((m) => m.id === MCP_ID.meta);
    if (meta && matchLoadCriteria(meta.loadCriteria, page)) {
      const skillsSnapshot = (bundle?.skills ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
      }));
      withOverlays.push(
        applyOverlays(
          {
            ...meta,
            skillsSnapshot,
            tools: meta.tools.map((tool) =>
              tool.name === LIST_SKILLS_TOOL_NAME
                ? {
                    ...tool,
                    description:
                      skillsSnapshot.length === 0
                        ? tool.description
                        : `${tool.description} Currently: ${skillsSnapshot
                            .map((s) => s.name)
                            .join(", ")}.`,
                  }
                : tool,
            ),
          },
          overlays,
        ),
      );
    }
  }

  return withOverlays
    .filter((m) => m.tools.length > 0)
    .map((manifest) => {
      const mcp = manifestToDomainMcp(manifest);
      return {
        id: manifest.id,
        layer: manifest.layer,
        fingerprint: fingerprintManifest(manifest),
        mcp,
      };
    });
}

function applyOverlays(
  manifest: McpManifest,
  overlays: Record<string, ToolPatch>,
): McpManifest {
  const names = Object.keys(overlays);
  if (names.length === 0) return manifest;
  return {
    ...manifest,
    tools: manifest.tools.map((tool: ToolRecipe) =>
      overlays[tool.name] ? applyOverlayToTool(tool, overlays[tool.name]) : tool,
    ),
  };
}
