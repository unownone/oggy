// ---------------------------------------------------------------------------
// Oggy side panel — per-origin MCP explorer
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import type { OggyMessage, OggyResponse } from "@/core";

async function send(msg: OggyMessage): Promise<OggyResponse> {
  return browser.runtime.sendMessage(msg) as Promise<OggyResponse>;
}

async function render(): Promise<void> {
  const listEl = document.querySelector<HTMLElement>('[data-testid="oggy-origin-list"]');
  if (!listEl) return;

  const resp = await send({ type: "oggy/origin/list" });
  if (!resp.ok || !("bundles" in resp)) return;

  listEl.innerHTML = "";

  for (const bundle of resp.bundles) {
    const row = document.createElement("div");
    row.setAttribute("data-testid", "oggy-origin-row");
    row.setAttribute("data-origin", bundle.origin);
    row.className = "origin-row";

    const originName = document.createElement("span");
    originName.className = "origin-name";
    originName.textContent = bundle.origin;

    const enableSwitch = document.createElement("button");
    enableSwitch.setAttribute("data-testid", "oggy-origin-enabled");
    enableSwitch.setAttribute("aria-pressed", String(bundle.enabled));
    enableSwitch.textContent = bundle.enabled ? "Enabled" : "Disabled";
    enableSwitch.addEventListener("click", async () => {
      await send({
        type: "oggy/origin/setEnabled",
        origin: bundle.origin,
        enabled: !bundle.enabled,
      });
      await render();
    });

    row.appendChild(originName);
    row.appendChild(enableSwitch);

    // Tool list
    if (bundle.mcp && bundle.mcp.tools.length > 0) {
      const toolList = document.createElement("div");
      toolList.setAttribute("data-testid", "oggy-tool-list");
      toolList.className = "tool-list";

      for (const tool of bundle.mcp.tools) {
        const toolRow = document.createElement("div");
        toolRow.setAttribute("data-testid", "oggy-tool-row");
        toolRow.setAttribute("data-tool", tool.name);
        toolRow.className = "tool-row";

        const toolName = document.createElement("code");
        toolName.textContent = tool.name;

        const toolDesc = document.createElement("span");
        toolDesc.className = "tool-desc";
        toolDesc.textContent = tool.description;

        toolRow.appendChild(toolName);
        toolRow.appendChild(toolDesc);
        toolList.appendChild(toolRow);
      }
      row.appendChild(toolList);

      // Delete MCP button
      const deleteBtn = document.createElement("button");
      deleteBtn.setAttribute("data-testid", "oggy-delete-mcp");
      deleteBtn.textContent = "Delete MCP";
      deleteBtn.addEventListener("click", async () => {
        await send({ type: "oggy/origin/delete", origin: bundle.origin });
        await render();
      });
      row.appendChild(deleteBtn);
    }

    listEl.appendChild(row);
  }
}

document.addEventListener("DOMContentLoaded", render);
