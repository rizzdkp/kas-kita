"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field } from "@/components/ui/field";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { authClient } from "../_components/auth-client";
import { authErrorMessage, EMPTY_FIELDS, NETWORK_ERROR, safeNextPath } from "../_components/auth-errors";

interface LoginFormProps {
  next?: string | undefined;
  sessionExpired: boolean;
}

export function LoginForm({ next, sessionExpired }: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (!email.trim() || !password) {
      setError(EMPTY_FIELDS);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password, rememberMe: remember });
      if (result.error) {
        setError(authErrorMessage(result.error));
        setPending(false);
        return;
      }
      router.replace(safeNextPath(next));
      router.refresh();
    } catch {
      setError(NETWORK_ERROR);
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="login-title" className="w-full rounded-card border border-border bg-surface p-6 sm:p-8">
      <h1 id="login-title" className="text-section text-primary">
        Kas Kita
      </h1>
      <p className="mt-1 text-small text-secondary">
        {sessionExpired ? "Sesimu berakhir. Masuk lagi untuk melanjutkan." : "Masuk untuk melihat keuangan kalian berdua."}
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Email">
          <Input
            type="email"
            name="email"
            autoComplete="username"
            inputMode="email"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-12"
            />
            <IconButton
              icon={showPassword ? EyeOff : Eye}
              label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 my-auto"
            />
          </div>
        </Field>
        <Checkbox label="Ingat perangkat ini (30 hari)" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {/* wadah tetap ada di DOM supaya pembaca layar mengumumkan pesan yang baru muncul */}
        <p role="alert" aria-live="assertive" className={error ? "text-small text-error" : "sr-only"}>
          {error}
        </p>
        <Button type="submit" variant="primary" loading={pending} className="w-full">
          Masuk
        </Button>
      </form>
    </section>
  );
}
