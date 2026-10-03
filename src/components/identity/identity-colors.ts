import type { IdentityColor } from "@/server/db/schema/users";

export type { IdentityColor };

export function identityColorVar(color: IdentityColor): string {
  return `var(--identity-${color})`;
}
