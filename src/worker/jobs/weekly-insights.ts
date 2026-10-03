import { runWeeklyInsights, type WeeklyInsightsRun } from "@/server/insights/generate";

export const JOB_WEEKLY_INSIGHTS = "insights.weekly";
// Senin 06.00 WIB (ARCHITECTURE 7)
export const WEEKLY_INSIGHTS_CRON = "0 6 * * 1";

/** Handler job insights.weekly; dipanggil langsung di tes integrasi. */
export async function handleWeeklyInsightsJob(now: Date = new Date()): Promise<WeeklyInsightsRun> {
  return runWeeklyInsights({ now });
}
