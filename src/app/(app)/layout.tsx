import { Suspense } from "react";
import type { ShellViewer } from "@/components/shell/types";
import { requireViewer } from "@/server/auth/session";
import { getQuickAddContext } from "@/server/queries/quick-add-context";
import { AppFrame } from "./app-frame";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const quickAdd = await getQuickAddContext(viewer);
  const shellViewer: ShellViewer = {
    me: { name: viewer.user.displayName, color: viewer.user.identityColor },
    partner: viewer.partner ? { name: viewer.partner.displayName, color: viewer.partner.identityColor } : null,
  };
  return (
    <Suspense>
      <AppFrame viewer={shellViewer} quickAdd={quickAdd}>{children}</AppFrame>
    </Suspense>
  );
}
