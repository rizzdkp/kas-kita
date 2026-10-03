// pengiriman web push berjalan di proses server app, bukan di build
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.DATABASE_URL) return;
  const { startPushListener } = await import("./server/push/listener");
  await startPushListener();
}
