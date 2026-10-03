"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Sparkles } from "lucide-react";
import { Button, buttonClassName } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { UploadAccountPicker, type ImportAccountOption } from "./upload-account-picker";
import { UploadDropzone } from "./upload-dropzone";
import { UploadPasswordDialog } from "./upload-password-dialog";
import { uploadImportFile, type ImportUploadOutcome } from "./upload-request";
import { EmptyImports } from "@/components/illustrations";

export type { ImportAccountOption };

type Phase =
  | { name: "idle" }
  | { name: "uploading"; progress: number }
  | { name: "password"; wrongPassword: boolean; busy: boolean }
  | { name: "unrecognized"; offerAi: boolean; error: string }
  | { name: "error"; error: string; href: string | null };

type UploadScreenProps = {
  accounts: ImportAccountOption[];
  initialAccountId: string | null;
};

function UploadProgress({ progress }: { progress: number }) {
  const percent = Math.round(progress * 100);
  const reading = percent >= 100;
  return (
    <div className="flex w-full max-w-sm flex-col gap-2" aria-busy>
      <p role="status" className="text-small text-primary">
        {reading ? "Membaca mutasi…" : `Mengunggah ${percent}%`}
      </p>
      <div
        role="progressbar"
        aria-label={reading ? "Membaca mutasi" : "Progres unggah"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={reading ? undefined : percent}
        className="h-1 overflow-hidden rounded-pill bg-surface-sunken"
      >
        <div className="h-full rounded-pill bg-accent transition-[width] duration-(--dur-base) ease-(--ease-out)" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

// kalimat terakhir pesan "sudah diimpor" jadi tautan ke hasil impor sebelumnya
function ErrorMessage({ error, href }: { error: string; href: string | null }) {
  const linkText = "Lihat hasil impornya.";
  if (href && error.endsWith(linkText)) {
    return (
      <p role="alert" className="text-small text-error">
        {error.slice(0, -linkText.length)}
        <Link href={href} className="text-primary underline underline-offset-4 hover:text-accent">
          {linkText}
        </Link>
      </p>
    );
  }
  return (
    <p role="alert" className="text-small text-error">
      {error}
    </p>
  );
}

/** Layar unggah impor mutasi: keputusan di sini hanya akun tujuan dan file mana. */
export function UploadScreen({ accounts, initialAccountId }: UploadScreenProps) {
  const router = useRouter();
  const [accountId, setAccountId] = useState<string | null>(initialAccountId);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  // password hanya di memori tab ini, untuk mengulang dengan AI; dibuang setelah selesai
  const passwordRef = useRef<string | undefined>(undefined);

  if (accounts.length === 0) {
    return (
      <Card className="max-w-3xl">
        <EmptyState
          illustration={<EmptyImports decorative />}
          title="Belum ada akun untuk menerima mutasi"
          action={
            <Link href="/akun?baru=1&jenis=bank" className={buttonClassName("primary")}>
              <Icon icon={Plus} />
              Tambah akun
            </Link>
          }
        >
          Mutasi diimpor ke akun bank, e-wallet, atau kartu kredit. Tambahkan akunnya dulu, lalu kembali ke sini.
        </EmptyState>
      </Card>
    );
  }

  const busy = phase.name === "uploading" || (phase.name === "password" && phase.busy);

  function handle(outcome: ImportUploadOutcome) {
    if (outcome.kind === "next") {
      passwordRef.current = undefined;
      setPhase({ name: "uploading", progress: 1 });
      router.push(outcome.href);
      return;
    }
    if (outcome.kind === "needs_password") setPhase({ name: "password", wrongPassword: outcome.wrongPassword, busy: false });
    else if (outcome.kind === "unrecognized") setPhase({ name: "unrecognized", offerAi: outcome.offerAi, error: outcome.error });
    else setPhase({ name: "error", error: outcome.error, href: outcome.href });
  }

  async function send(opts: { password?: string; readWithAi?: boolean } = {}) {
    if (!accountId || !file) return;
    passwordRef.current = opts.password ?? passwordRef.current;
    if (phase.name === "password") setPhase({ ...phase, busy: true });
    else setPhase({ name: "uploading", progress: 0 });
    const outcome = await uploadImportFile({ accountId, file, password: passwordRef.current, readWithAi: opts.readWithAi }, (progress) =>
      setPhase((p) => (p.name === "uploading" ? { name: "uploading", progress } : p)),
    );
    handle(outcome);
  }

  function reset() {
    passwordRef.current = undefined;
    setPhase({ name: "idle" });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-8 pb-32">
      <p className="max-w-[60ch] text-small text-secondary">
        Unggah mutasi CSV dari internet banking atau e-statement PDF. Semua baris kamu tinjau dulu sebelum masuk ke Transaksi.
      </p>

      <UploadAccountPicker
        accounts={accounts}
        value={accountId}
        onChange={(id) => {
          setAccountId(id);
          if (phase.name !== "uploading") reset();
        }}
        disabled={busy}
      />

      <UploadDropzone
        file={file}
        onFile={(f) => {
          setFile(f);
          reset();
        }}
        disabled={busy}
      />

      <div className="flex flex-col items-start gap-4">
        {phase.name === "error" ? <ErrorMessage error={phase.error} href={phase.href} /> : null}
        {phase.name === "unrecognized" ? (
          <div className="flex flex-col items-start gap-3">
            <p role="alert" className="max-w-[60ch] text-small text-primary">
              {phase.error}
            </p>
            {phase.offerAi ? (
              <Button variant="secondary" icon={Sparkles} onClick={() => send({ readWithAi: true })}>
                Baca dengan AI
              </Button>
            ) : (
              <Link href="/pengaturan#ai" className={buttonClassName("secondary")}>
                Buka pengaturan AI
              </Link>
            )}
          </div>
        ) : null}
        {phase.name === "uploading" ? (
          <UploadProgress progress={phase.progress} />
        ) : (
          <div className="flex flex-col items-start gap-2">
            <Button variant="primary" onClick={() => send()} disabled={!accountId || !file || busy}>
              Unggah
            </Button>
            {!accountId || !file ? (
              <p className="text-small text-secondary">{!accountId ? "Pilih akun tujuan dan file mutasi." : "Pilih file mutasi."}</p>
            ) : null}
          </div>
        )}
      </div>

      <UploadPasswordDialog
        open={phase.name === "password"}
        wrongPassword={phase.name === "password" && phase.wrongPassword}
        busy={phase.name === "password" && phase.busy}
        onSubmit={(password) => send({ password })}
        onCancel={reset}
      />
    </div>
  );
}
