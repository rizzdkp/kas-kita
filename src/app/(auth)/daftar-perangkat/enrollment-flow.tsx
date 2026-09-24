"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "../_components/auth-client";
import { authErrorMessage, setRememberDevice } from "../_components/auth-errors";
import { AuthCard, Button, Checkbox, StatusMessage } from "../_components/ui";
import { BackupSetup } from "./backup-setup";

type Step = "passkey" | "backup" | "done";

interface EnrollmentFlowProps {
  token: string;
  displayName: string;
  email: string;
  initialStep: Exclude<Step, "done">;
}

export function EnrollmentFlow({ token, displayName, email, initialStep }: EnrollmentFlowProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(initialStep);
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function registerPasskey() {
    setPending(true);
    setError(null);
    setRememberDevice(remember);
    const result = await authClient.passkey.addPasskey({ context: token, createSession: true, name: deviceLabel() });
    setPending(false);
    if (result?.error) return setError(authErrorMessage(result.error));
    setStep("backup");
  }

  function openApp() {
    router.replace("/");
    router.refresh();
  }

  if (step === "passkey") {
    return (
      <AuthCard
        title={`Hai, ${displayName}`}
        description={
          <>
            Daftarkan passkey di perangkat ini untuk {email}. Setelah itu kamu masuk dengan Face ID, sidik jari, atau PIN
            perangkat, tanpa password.
          </>
        }
      >
        <Checkbox id="remember-device" label="Ingat perangkat ini (30 hari)" checked={remember} onChange={setRemember} />
        <StatusMessage message={error} />
        <Button onClick={registerPasskey} disabled={pending}>
          <KeyRound aria-hidden size={20} strokeWidth={1.75} />
          {pending ? "Menunggu passkey" : "Daftarkan passkey"}
        </Button>
      </AuthCard>
    );
  }

  if (step === "backup") return <BackupSetup onDone={() => setStep("done")} />;

  return (
    <AuthCard title="Perangkat terdaftar" description="Mulai sekarang kamu bisa masuk dengan passkey di perangkat ini.">
      <Button onClick={openApp}>Buka Kas Kita</Button>
    </AuthCard>
  );
}

// nama passkey membantu membedakan perangkat di daftar Pengaturan
function deviceLabel(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac OS X/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Perangkat";
}
