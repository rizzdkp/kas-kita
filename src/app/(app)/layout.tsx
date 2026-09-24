import { Suspense } from "react";
import type { ShellViewer } from "@/components/shell/types";
import { requireViewer } from "@/server/auth/session";
import { AppFrame } from "./app-frame";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const shellViewer: ShellViewer = {
    me: { name: viewer.user.displayName, color: viewer.user.identityColor },
    partner: viewer.partner ? { name: viewer.partner.displayName, color: viewer.partner.identityColor } : null,
  };
  return (
    <Suspense>
      <AppFrame viewer={shellViewer}>{children}</AppFrame>
    </Suspense>
  );
}
