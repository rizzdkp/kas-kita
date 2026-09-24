"use client";

import { useState, type FormEvent } from "react";
import { confirmBackupTotp, startBackupSetup } from "@/server/auth/enrollment-actions";
import { MIN_PASSWORD_LENGTH } from "@/server/auth/constants";
import { AuthCard, Button, Field, StatusMessage } from "../_components/ui";

interface TotpSecret {
  totpUri: string;
  secret: string;
}

// kelompok 4 karakter supaya secret mudah diketik ulang di aplikasi autentikator
function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function BackupSetup({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [totp, setTotp] = useState<TotpSecret | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < MIN_PASSWORD_LENGTH) return setError(`Password minimal ${MIN_PASSWORD_LENGTH} karakter.`);
    if (password !== confirm) return setError("Kedua password belum sama.");
    setPending(true);
    setError(null);
    const result = await startBackupSetup(password);
    setPending(false);
    if (!result.ok) return setError(result.error);
    setPassword("");
    setConfirm("");
    setTotp({ totpUri: result.totpUri, secret: result.secret });
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await confirmBackupTotp(code);
    setPending(false);
    if (!result.ok) return setError(result.error);
    onDone();
  }

  if (totp) {
    return (
      <AuthCard
        title="Pasang kode autentikator"
        description="Tambahkan Kas Kita ke aplikasi autentikator (misalnya Google Authenticator, 1Password, atau Aegis), lalu masukkan kode 6 angka yang muncul."
      >
        <a
          href={totp.totpUri}
          className="text-[15px] font-medium text-[var(--accent)] underline-offset-4 hover:underline outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          Buka di aplikasi autentikator
        </a>
        <div className="flex flex-col gap-2">
          <p id="totp-secret-label" className="text-sm text-[var(--text-secondary)]">
            Atau ketik kunci ini secara manual:
          </p>
          <code
            aria-labelledby="totp-secret-label"
            className="rounded-[var(--radius-md)] bg-[var(--surface-sunken)] px-3 py-2 font-mono text-base break-all text-[var(--text-primary)] select-all"
          >
            {groupSecret(totp.secret)}
          </code>
        </div>
        <form onSubmit={submitCode} className="flex flex-col gap-4" noValidate>
          <Field
            id="totp-code"
            label="Kode autentikator"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <StatusMessage message={error} />
          <Button type="submit" disabled={pending || code.length !== 6}>
            {pending ? "Memeriksa" : "Aktifkan"}
          </Button>
        </form>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Password cadangan"
      description="Opsional. Password dan kode TOTP dipakai kalau passkey tidak tersedia, misalnya di perangkat baru."
    >
      <form onSubmit={submitPassword} className="flex flex-col gap-4" noValidate>
        <Field
          id="new-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          hint={`Minimal ${MIN_PASSWORD_LENGTH} karakter.`}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Field
          id="confirm-password"
          label="Ulangi password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <StatusMessage message={error} />
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan" : "Lanjut"}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Lewati
        </Button>
      </form>
    </AuthCard>
  );
}
