import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import type { ShellViewer } from "@/components/shell/types";

// SEMENTARA (M0): data contoh sampai koordinator menyambung shell ke sesi Better Auth (getViewer).
const CONTOH_VIEWER_SEMENTARA: ShellViewer = {
  me: { name: "Contoh Saya", color: "ocean" },
  partner: { name: "Contoh Partner", color: "rose" },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense>
      <AppShell viewer={CONTOH_VIEWER_SEMENTARA}>{children}</AppShell>
    </Suspense>
  );
}
