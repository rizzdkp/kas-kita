"use client";

import { useState, useTransition } from "react";
import { ListRestart } from "lucide-react";
import type { ConnectionCheck } from "@/server/ai/test-connection";
import { fetchAiModelsAction, saveAiSettingsAction, testAiConnectionAction } from "@/server/actions/ai-settings";
import type { ActionError } from "@/server/actions/result";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { AiDeleteButton } from "./ai-delete-dialog";
import { ModelCombobox } from "./ai-model-combobox";
import { AiTestResults } from "./ai-test-results";
import { firstFieldError, formLevelError, useSave } from "./use-save";

/** Yang dikirim server ke form: tanpa API key, hanya 4 karakter terakhirnya (F-AI-1 AC3). */
export type AiSettingsFormData = {
  version: number;
  baseUrl: string;
  apiKeyLast4: string | null;
  textModel: string | null;
  visionModel: string | null;
};

type Saved = AiSettingsFormData | null;
type ModelsState = { models: string[] | null; message: string | null };

export function AiSettingsForm({ initial }: { initial: Saved }) {
  const [saved, setSaved] = useState<Saved>(initial);
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "");
  const [apiKey, setApiKey] = useState("");
  const [textModel, setTextModel] = useState(initial?.textModel ?? "");
  const [visionModel, setVisionModel] = useState(initial?.visionModel ?? "");
  const [models, setModels] = useState<ModelsState>({ models: null, message: null });
  const [checks, setChecks] = useState<ConnectionCheck[] | null>(null);
  const [error, setError] = useState<ActionError | null>(null);
  const [fetching, startFetch] = useTransition();
  const [testing, startTest] = useTransition();
  const { pending: saving, save } = useSave();

  const hasKey = apiKey.trim() !== "" || Boolean(saved?.apiKeyLast4);
  const canReach = baseUrl.trim() !== "" && hasKey;
  const dirty =
    !saved ||
    apiKey.trim() !== "" ||
    baseUrl.trim() !== saved.baseUrl ||
    textModel.trim() !== (saved.textModel ?? "") ||
    visionModel.trim() !== (saved.visionModel ?? "");
  const endpoint = { baseUrl: baseUrl.trim(), apiKey: apiKey.trim() };
  const generalError = formLevelError(error, ["baseUrl", "apiKey", "textModel", "visionModel"]);

  function fetchModels() {
    setError(null);
    startFetch(async () => {
      const result = await fetchAiModelsAction(endpoint);
      if (!result.ok) {
        setError(result);
        return;
      }
      setModels(result.data.ok ? { models: result.data.models, message: `${result.data.models.length} model ditemukan. Pilih di bawah atau ketik ID-nya.` } : { models: null, message: result.data.message });
    });
  }

  function testConnection() {
    setError(null);
    setChecks(null);
    startTest(async () => {
      const result = await testAiConnectionAction({ ...endpoint, textModel, visionModel });
      if (result.ok) setChecks(result.data.checks);
      else setError(result);
    });
  }

  function reset() {
    setSaved(null);
    setBaseUrl("");
    setApiKey("");
    setTextModel("");
    setVisionModel("");
    setModels({ models: null, message: null });
    setChecks(null);
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        save(() => saveAiSettingsAction({ ...endpoint, textModel, visionModel, version: saved?.version ?? null }), {
          onError: setError,
          onSuccess: (data) => {
            setSaved({ version: data.version, apiKeyLast4: data.apiKeyLast4, baseUrl: baseUrl.trim().replace(/\/+$/, ""), textModel: textModel.trim() || null, visionModel: visionModel.trim() || null });
            setApiKey("");
          },
        });
      }}
    >
      {saved ? null : (
        <p className="max-w-[65ch] text-small text-secondary">
          AI belum dipasang. Tidak ada data yang dikirim ke penyedia AI mana pun, dan Kas Kita membaca teks di bar bawah sendiri, tanpa AI.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Base URL" description="Alamat server yang kompatibel dengan OpenAI, biasanya diakhiri /v1." error={firstFieldError(error, "baseUrl")}>
          <Input
            type="url"
            inputMode="url"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="https://api.openai.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </Field>
        <Field
          label="API key"
          description={saved?.apiKeyLast4 ? `Tersimpan, berakhiran ••••${saved.apiKeyLast4}. Kosongkan kalau tidak diganti.` : "Disimpan terenkripsi dan tidak pernah dikirim ke browser."}
          error={firstFieldError(error, "apiKey")}
        >
          <Input
            type="password"
            autoComplete="new-password"
            spellCheck={false}
            placeholder={saved?.apiKeyLast4 ? `••••${saved.apiKeyLast4}` : undefined}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
      </div>

      <div className="flex flex-col items-start gap-2">
        <Button icon={ListRestart} onClick={fetchModels} loading={fetching} disabled={!canReach}>
          Ambil daftar model
        </Button>
        <p className="text-small text-secondary" aria-live="polite">
          {models.message ?? (canReach ? "Atau ketik ID model langsung di kolom model." : "Isi base URL dan API key untuk mengambil daftar model.")}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ModelCombobox
          label="Model teks"
          description="Membaca teks transaksi di bar bawah."
          value={textModel}
          onChange={setTextModel}
          models={models.models}
          placeholder="Cari atau ketik ID model"
        />
        <ModelCombobox
          label="Model vision"
          description="Membaca foto struk. Pilih model yang bisa membaca gambar."
          value={visionModel}
          onChange={setVisionModel}
          models={models.models}
          placeholder="Cari atau ketik ID model"
        />
      </div>

      <div aria-live="polite">{checks ? <AiTestResults checks={checks} /> : null}</div>

      {generalError ? <p className="text-small text-error">{generalError}</p> : null}

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>{saved ? <AiDeleteButton version={saved.version} onDeleted={reset} /> : null}</div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button onClick={testConnection} loading={testing} disabled={!canReach || (!textModel.trim() && !visionModel.trim())}>
            Tes koneksi
          </Button>
          <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
            Simpan
          </Button>
        </div>
      </div>
    </form>
  );
}
