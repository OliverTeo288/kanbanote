/**
 * Delay (ms) before auto-focusing a modal input.
 * Prevents a race with the modal open animation that can cause focus to be lost.
 */
export const FOCUS_DELAY_MS = 50;

/** Generates a cryptographically random ID. (SECURITY: replaces insecure Math.random) */
export function nanoid(): string {
  return crypto.randomUUID();
}

/** Formats an ISO date string as "DD MMM YYYY". */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

/** Returns true if the given ISO date string is in the past. Guards against Invalid Date. */
export function isOverdue(iso: string): boolean {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  return d < new Date(new Date().toDateString());
}

export function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Human-readable relative time, e.g. "3 hours ago", "just now". Guards against Invalid Date. */
export function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(iso);
}

/**
 * Returns true if the vault-relative path is safe to pass to vault adapter calls.
 * Rejects absolute paths and directory traversal (../../) segments.
 */
export function isSafeVaultPath(path: string): boolean {
  if (!path || path.trim() === "") return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (/(?:^|\/)\.\.(?:\/|$)/.test(path)) return false;
  return true;
}

/**
 * Returns true if the CSS color string is a safe hex colour or an Obsidian CSS variable.
 * Prevents CSS injection when applying untrusted data from vault JSON to style properties.
 */
export function isSafeColor(color: string): boolean {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) || /^var\(--[a-zA-Z0-9-]+\)$/.test(color);
}
