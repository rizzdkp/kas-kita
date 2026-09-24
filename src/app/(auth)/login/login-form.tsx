"use client";

import { KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient } from "../_components/auth-client";
import { authErrorMessage, safeNextPath, setRememberDevice } from "../_components/auth-errors";
import { AuthCard, Button, Checkbox, Field, StatusMessage } from "../_components/ui";

type Step = "passkey" | "password" | "totp";

interface LoginFormProps {
  next?: string | undefined;
  sessionExpired: boolean;
}

export function LoginForm({ next, sessionExpired }: LoginFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("passkey");
  const [remember, setRemember] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // fokus pindah ke field pertama setiap ganti langkah supaya pengguna keyboard tidak tersesat
  useEffect(() => {
    if (step !== "passkey") firstFieldRef.current?.focus();
  }, [step]);

  function finish() {
    router.replace(safeNextPath(next));
    router.refresh();
  }

  async function signInWithPasskey() {
    setPending(true);
    setError(null);
    setRememberDevice(remember);
    const result = await authClient.signIn.passkey();
    setPending(false);
    if (result?.error) return setError(authErrorMessage(result.error));
    finish();
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setRememberDevice(remember);
    const result = await authClient.signIn.email({ email, password, rememberMe: remember });
    setPending(false);
    if (result.error) return setError(authErrorMessage(result.error));
    setPassword("");
    // akun tanpa TOTP ditolak server, jadi respons sukses selalu berupa permintaan TOTP
    if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) return setStep("totp");
    finish();
  }

  async function submitTotp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await authClient.twoFactor.verifyTotp({ code: code.trim() });
    setPending(false);
    if (result.error) {
      setCode("");
      if (result.error.code === "INVALID_TWO_FACTOR_COOKIE" || result.error.code === "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE") setStep("password");
      return setError(authErrorMessage(result.error));
    }
    finish();
  }

  const rememberBox = (
    <Checkbox id="remember-device" label="Ingat perangkat ini (30 hari)" checked={remember} onChange={setRemember} />
  );

  if (step === "totp") {
    return (
      <AuthCard title="Masukkan kode" description="Buka aplikasi autentikator lalu masukkan 6 angka untuk Kas Kita.">
        <form onSubmit={submitTotp} className="flex flex-col gap-4" noValidate>
          <Field
            ref={firstFieldRef}
            id="totp-code"
            label="Kode autentikator"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <StatusMessage message={error} />
          <Button type="submit" disabled={pending || code.length !== 6}>
            {pending ? "Memeriksa" : "Masuk"}
          </Button>
          <Button variant="ghost" onClick={() => { setStep("password"); setError(null); }}>
            Kembali
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Masuk ke Kas Kita"
      description={sessionExpired ? "Sesimu berakhir. Masuk lagi untuk melanjutkan." : undefined}
    >
      {step === "passkey" ? (
        <>
          {rememberBox}
          <StatusMessage message={error} />
          <Button onClick={signInWithPasskey} disabled={pending}>
            <KeyRound aria-hidden size={20} strokeWidth={1.75} />
            {pending ? "Menunggu passkey" : "Masuk dengan passkey"}
          </Button>
          <Button variant="ghost" onClick={() => { setStep("password"); setError(null); }}>
            Pakai password
          </Button>
        </>
      ) : (
        <form onSubmit={submitPassword} className="flex flex-col gap-4" noValidate>
          <Field
            ref={firstFieldRef}
            id="email"
            label="Email"
            type="email"
            autoComplete="username webauthn"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Field
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {rememberBox}
          <StatusMessage message={error} />
          <Button type="submit" disabled={pending || !email || !password}>
            {pending ? "Memeriksa" : "Lanjut"}
          </Button>
          <Button variant="ghost" onClick={() => { setStep("passkey"); setError(null); }}>
            Masuk dengan passkey
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
