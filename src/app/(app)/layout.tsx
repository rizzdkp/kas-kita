import { Suspense } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ShellViewer } from "@/components/shell/types";
import { ONBOARDING_PATH, PATHNAME_HEADER } from "@/server/auth/constants";
import { requireViewer } from "@/server/auth/session";
import { countUnreadNotifications } from "@/server/queries/notifications";
import { getQuickAddContext } from "@/server/queries/quick-add-context";
import { needsOnboarding } from "@/server/queries/settings";
import { AppFrame } from "./app-frame";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const pathname = (await headers()).get(PATHNAME_HEADER);
  if (needsOnboarding(viewer) && pathname !== ONBOARDING_PATH) redirect(ONBOARDING_PATH);

  const [quickAdd, unread] = await Promise.all([getQuickAddContext(viewer), countUnreadNotifications(viewer)]);
  const shellViewer: ShellViewer = {
    me: { name: viewer.user.displayName, color: viewer.user.identityColor },
    partner: viewer.partner ? { name: viewer.partner.displayName, color: viewer.partner.identityColor } : null,
  };
  return (
    <Suspense>
      <AppFrame viewer={shellViewer} quickAdd={quickAdd} unread={unread}>
        {children}
      </AppFrame>
    </Suspense>
  );
}
