"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { revokeSessionAction } from "@/server/auth/actions";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

/** Mencabut sesi saat ini mengarahkan ke halaman masuk lewat redirect di server action. */
export function RevokeSessionButton({ sessionId, deviceLabel }: { sessionId: string; deviceLabel: string }) {
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  return (
    <Button
      variant="danger"
      icon={LogOut}
      loading={pending}
      aria-label={`Keluar dari perangkat ini: ${deviceLabel}`}
      onClick={() =>
        startTransition(async () => {
          const result = await revokeSessionAction(sessionId);
          toast.show({ title: result.ok ? `${deviceLabel} sudah keluar` : result.error });
        })
      }
    >
      Keluar dari perangkat ini
    </Button>
  );
}
