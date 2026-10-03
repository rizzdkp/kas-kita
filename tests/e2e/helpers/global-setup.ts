import { execFileSync } from "node:child_process";

/** Soft delete data "E2E …" di akhir run, juga kalau tes gagal di tengah dan tidak sempat menghapus datanya. */
function cleanup(since: string): void {
  try {
    const out = execFileSync("bash", ["-c", `set -a; . ./.env.local; set +a; npx tsx scripts/e2e-cleanup.ts ${JSON.stringify(since)}`], {
      encoding: "utf8",
    });
    console.log(`e2e-cleanup: ${out.trim().split("\n").at(-1)}`);
  } catch (error) {
    // pembersihan gagal tidak boleh menutupi hasil tes
    console.warn("e2e-cleanup gagal", error);
  }
}

export default function globalSetup(): () => void {
  const since = new Date().toISOString();
  // sisa run sebelumnya (termasuk pengaturan AI palsu) dibersihkan dulu supaya tes non-AI mulai dari keadaan tanpa AI
  cleanup(since);
  return () => cleanup(since);
}
