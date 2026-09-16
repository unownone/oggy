// ---------------------------------------------------------------------------
// Oggy side panel — per-origin MCP explorer
// ---------------------------------------------------------------------------

import { browser } from "wxt/browser";
import type { OggyMessage, OggyResponse, OriginBundle } from "@/core";
import { createSkillFromFlow } from "@/core/skills";

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

    appendPendingUpdates(row, bundle);
    appendSkillFlow(row, bundle);
    appendSkills(row, bundle);

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

function appendPendingUpdates(row: HTMLElement, bundle: OriginBundle): void {
  const pending = (bundle.pendingUpdates ?? []).filter((p) => p.status === "pending");
  if (pending.length === 0) return;

  const heading = document.createElement("h3");
  heading.textContent = "Permission required";
  row.appendChild(heading);

  for (const proposal of pending) {
    const box = document.createElement("div");
    box.setAttribute("data-testid", "oggy-pending-update");
    box.setAttribute("data-proposal", proposal.id);
    box.className = "pending-box";

    const title = document.createElement("strong");
    title.textContent = `Update ${proposal.toolName}`;
    const reason = document.createElement("span");
    reason.className = "pending-reason";
    reason.textContent = proposal.reason || "(no reason given)";

    const approve = document.createElement("button");
    approve.setAttribute("data-testid", "oggy-approve-update");
    approve.textContent = "Approve";
    approve.addEventListener("click", async () => {
      await send({
        type: "oggy/tool/resolveUpdate",
        origin: bundle.origin,
        proposalId: proposal.id,
        decision: "approved",
      });
      await render();
    });

    const deny = document.createElement("button");
    deny.setAttribute("data-testid", "oggy-deny-update");
    deny.textContent = "Deny";
    deny.addEventListener("click", async () => {
      await send({
        type: "oggy/tool/resolveUpdate",
        origin: bundle.origin,
        proposalId: proposal.id,
        decision: "denied",
      });
      await render();
    });

    box.appendChild(title);
    box.appendChild(reason);
    box.appendChild(approve);
    box.appendChild(deny);
    row.appendChild(box);
  }
}

function appendSkillFlow(row: HTMLElement, bundle: OriginBundle): void {
  const session = [...(bundle.sessions ?? [])].reverse().find((s) => s.skillFlow);
  const flow = session?.skillFlow;
  if (!flow || flow.steps.length === 0) return;

  const box = document.createElement("div");
  box.setAttribute("data-testid", "oggy-skill-flow");
  box.className = "skill-flow";

  const heading = document.createElement("h3");
  heading.textContent = "Skill flow (create to save)";
  const summary = document.createElement("p");
  summary.textContent = flow.suggestedDescription;

  const list = document.createElement("ol");
  for (const step of flow.steps) {
    const li = document.createElement("li");
    const hint = step.toolHint ? ` → ${step.toolHint}` : "";
    const read = step.requiredRead ? " [read required]" : "";
    li.textContent = `${step.primitive}${hint}${read}`;
    list.appendChild(li);
  }

  const createBtn = document.createElement("button");
  createBtn.setAttribute("data-testid", "oggy-create-skill");
  createBtn.textContent = `Create skill: ${flow.suggestedName}`;
  createBtn.addEventListener("click", async () => {
    await send({
      type: "oggy/skill/create",
      origin: bundle.origin,
      skill: createSkillFromFlow({ flow }),
    });
    await render();
  });

  box.appendChild(heading);
  box.appendChild(summary);
  box.appendChild(list);
  box.appendChild(createBtn);
  row.appendChild(box);
}

function appendSkills(row: HTMLElement, bundle: OriginBundle): void {
  const skills = bundle.skills ?? [];
  if (skills.length === 0) return;

  const box = document.createElement("div");
  box.setAttribute("data-testid", "oggy-skill-list");
  box.className = "skill-list";
  const heading = document.createElement("h3");
  heading.textContent = "Skills";
  box.appendChild(heading);

  for (const skill of skills) {
    const item = document.createElement("div");
    item.setAttribute("data-testid", "oggy-skill-row");
    item.setAttribute("data-skill", skill.name);
    const name = document.createElement("code");
    name.textContent = skill.name;
    const desc = document.createElement("span");
    desc.className = "tool-desc";
    desc.textContent = skill.description;
    item.appendChild(name);
    item.appendChild(desc);
    box.appendChild(item);
  }
  row.appendChild(box);
}

document.addEventListener("DOMContentLoaded", render);
