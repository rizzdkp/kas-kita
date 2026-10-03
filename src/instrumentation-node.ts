import { startPushListener } from "./server/push/listener";

export async function startNodeServices(): Promise<void> {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.DATABASE_URL) return;
  await startPushListener();
}
