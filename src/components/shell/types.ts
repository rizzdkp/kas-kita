import type { IdentityColor } from "@/components/identity/identity-colors";

export type ShellPerson = { name: string; color: IdentityColor };

/** Data minimal yang dibutuhkan shell; koordinator mengisinya dari Viewer sesi. */
export type ShellViewer = { me: ShellPerson; partner: ShellPerson | null };
