export const SCOPES = ["me", "partner", "all"] as const;
export type Scope = (typeof SCOPES)[number];

export function parseScope(value: unknown): Scope {
  return typeof value === "string" && (SCOPES as readonly string[]).includes(value) ? (value as Scope) : "me";
}
