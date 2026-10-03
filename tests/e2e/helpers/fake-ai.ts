import { spawn } from "node:child_process";

/** Menjalankan scripts/fake-ai-server.ts di port tertentu dan menunggu sampai siap; kembalikan fungsi berhenti. */
export async function startFakeAi(port: number, env: Record<string, string> = {}): Promise<() => Promise<void>> {
  const proc = spawn(process.execPath, ["--import", "tsx", "scripts/fake-ai-server.ts"], {
    env: { ...process.env, ...env, FAKE_AI_PORT: String(port) },
    stdio: "ignore",
  });
  const base = `http://localhost:${port}/v1`;
  for (let i = 0; i < 100; i++) {
    if (await fetch(`${base}/models`).then((r) => r.ok, () => false)) {
      return () =>
        new Promise<void>((resolve) => {
          if (proc.exitCode !== null) return resolve();
          proc.once("exit", () => resolve());
          proc.kill("SIGTERM");
        });
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  proc.kill("SIGTERM");
  throw new Error("fake AI server tidak jalan");
}
