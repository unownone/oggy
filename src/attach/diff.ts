import type {
  AttachmentState,
  AttachmentTarget,
  AttachPlan,
} from "@/core/mcp-manifest";

/**
 * Idempotent attach/detach plan. Same fingerprint → no MAIN I/O.
 * Fingerprint change for an existing id is a replace (attach only;
 * MAIN aborts that id before registering).
 */
export function diffAttachments(
  current: AttachmentState,
  desired: AttachmentTarget[],
): AttachPlan {
  const desiredById = new Map(desired.map((t) => [t.id, t]));
  const attach: AttachmentTarget[] = [];
  const detach: string[] = [];
  const unchanged: string[] = [];

  for (const target of desired) {
    const prev = current[target.id];
    if (prev && prev.fingerprint === target.fingerprint) {
      unchanged.push(target.id);
    } else {
      attach.push(target);
    }
  }

  for (const id of Object.keys(current)) {
    if (!desiredById.has(id)) detach.push(id);
  }

  return { attach, detach, unchanged };
}

export function applyAttachPlan(
  current: AttachmentState,
  plan: AttachPlan,
  desired: AttachmentTarget[],
): AttachmentState {
  const next: AttachmentState = { ...current };
  for (const id of plan.detach) {
    delete next[id];
  }
  for (const target of desired) {
    if (plan.unchanged.includes(target.id) || plan.attach.includes(target)) {
      next[target.id] = { fingerprint: target.fingerprint };
    }
  }
  return next;
}
