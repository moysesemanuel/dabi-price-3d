export type WorkspaceAuditTone = "neutral" | "success" | "warning";

export type WorkspaceAuditEventType =
  | "preferences-updated"
  | "onboarding-completed"
  | "plan-updated"
  | "calculation-saved"
  | "calculation-updated"
  | "calculation-deleted"
  | "history-cleared"
  | "erp-synced"
  | "site-product-linked";

export type WorkspaceAuditEvent = {
  id: string;
  occurredAt: string;
  type: WorkspaceAuditEventType;
  title: string;
  description: string;
  tone: WorkspaceAuditTone;
};

const STORAGE_KEY = "dabi-price-3d:workspace-audit-log";
const AUDIT_EVENT = "dabi-price-3d:workspace-audit-log-updated";
const MAX_AUDIT_ITEMS = 250;
const EMPTY_AUDIT_LOG: WorkspaceAuditEvent[] = [];

let cachedAuditRawValue: string | null | undefined;
let cachedAuditSnapshot: WorkspaceAuditEvent[] = EMPTY_AUDIT_LOG;

export function readWorkspaceAuditLog() {
  if (typeof window === "undefined") {
    return EMPTY_AUDIT_LOG;
  }

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY);

    if (rawValue === cachedAuditRawValue) {
      return cachedAuditSnapshot;
    }

    const parsedLog = parseWorkspaceAuditLog(rawValue);

    cachedAuditRawValue = rawValue;
    cachedAuditSnapshot = parsedLog;

    return parsedLog;
  } catch {
    cachedAuditRawValue = null;
    cachedAuditSnapshot = EMPTY_AUDIT_LOG;
    return EMPTY_AUDIT_LOG;
  }
}

export function appendWorkspaceAuditEvent(
  input: Omit<WorkspaceAuditEvent, "id" | "occurredAt"> & {
    occurredAt?: string;
  },
) {
  if (typeof window === "undefined") {
    return null;
  }

  const nextEvent: WorkspaceAuditEvent = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `audit-${Date.now()}`,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim(),
    tone: input.tone,
  };
  const nextItems = [nextEvent, ...readWorkspaceAuditLog()].slice(
    0,
    MAX_AUDIT_ITEMS,
  );

  writeWorkspaceAuditLog(nextItems);

  return nextEvent;
}

export function clearWorkspaceAuditLog() {
  if (typeof window === "undefined") {
    return;
  }

  cachedAuditRawValue = null;
  cachedAuditSnapshot = EMPTY_AUDIT_LOG;
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(AUDIT_EVENT));
}

export function subscribeWorkspaceAuditLog(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleChange = () => onStoreChange();

  window.addEventListener(AUDIT_EVENT, handleChange);
  window.addEventListener("storage", handleChange);

  return () => {
    window.removeEventListener(AUDIT_EVENT, handleChange);
    window.removeEventListener("storage", handleChange);
  };
}

function writeWorkspaceAuditLog(items: WorkspaceAuditEvent[]) {
  const serializedItems = JSON.stringify(items);

  cachedAuditRawValue = serializedItems;
  cachedAuditSnapshot = items;
  window.localStorage.setItem(STORAGE_KEY, serializedItems);
  window.dispatchEvent(new Event(AUDIT_EVENT));
}

function parseWorkspaceAuditLog(rawValue: string | null) {
  if (!rawValue) {
    return EMPTY_AUDIT_LOG;
  }

  const parsedValue = JSON.parse(rawValue) as WorkspaceAuditEvent[];

  return Array.isArray(parsedValue) ? parsedValue : EMPTY_AUDIT_LOG;
}
