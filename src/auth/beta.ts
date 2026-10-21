import { z } from "zod";

function normalizeEmail(email: string | null | undefined): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function parseBetaAllowlist(value: string | undefined): ReadonlySet<string> | undefined {
  if (!value?.trim()) return undefined;
  const emails = value.split(",").map(normalizeEmail).filter(Boolean);
  if (!emails.length || emails.some(email => !z.email().safeParse(email).success)) {
    // Configuration failures must never echo private account addresses.
    throw new Error("BETA_ALLOWLIST must contain comma-separated email addresses.");
  }
  return new Set(emails);
}

export function allowsBetaEmail(
  email: string | null | undefined,
  allowlist: ReadonlySet<string> | undefined
): boolean {
  return !allowlist || allowlist.has(normalizeEmail(email));
}
