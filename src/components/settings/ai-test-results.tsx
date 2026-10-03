import { CircleAlert, CircleCheck, CircleDashed, ImageOff, type LucideIcon } from "lucide-react";
import type { ConnectionCheck, ConnectionStatus } from "@/server/ai/test-connection";
import { cn } from "@/components/ui/cn";
import { Icon } from "@/components/ui/icon";

const STATUS_ICON: Record<ConnectionStatus, { icon: LucideIcon; tone: string }> = {
  ok: { icon: CircleCheck, tone: "text-positive" },
  failed: { icon: CircleAlert, tone: "text-error" },
  no_vision: { icon: ImageOff, tone: "text-attention" },
  skipped: { icon: CircleDashed, tone: "text-tertiary" },
};

const KIND_LABEL = { text: "Model teks", vision: "Model vision" } as const;

/** Hasil tes koneksi per model (F-AI-1 AC2): berhasil, gagal dengan pesan server, atau tidak mendukung gambar. */
export function AiTestResults({ checks }: { checks: readonly ConnectionCheck[] }) {
  const allOk = checks.every((c) => c.status === "ok");
  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-sunken p-4">
      <p className="text-control text-primary">{allOk ? "Model teks dan model vision merespons" : "Hasil tes koneksi"}</p>
      <ul className="flex flex-col gap-3">
        {checks.map((check) => {
          const { icon, tone } = STATUS_ICON[check.status];
          return (
            <li key={check.kind} className="flex items-start gap-3">
              <Icon icon={icon} className={cn("mt-0.5 shrink-0", tone)} />
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-small text-primary">
                  <span className="font-medium">{KIND_LABEL[check.kind]}</span>
                  {check.model ? <span className="break-all text-secondary"> · {check.model}</span> : null}
                </p>
                <p className="text-small text-secondary">{check.message}</p>
                {check.serverMessage ? <p className="break-words text-small text-secondary">Pesan server: {check.serverMessage}</p> : null}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
