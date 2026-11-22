import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { sendLessons, sendReminders } from "@/lib/line/handler";

/** Cloud Scheduler 每天呼叫一次，帶 X-Cron-Key。推播回診和照顧提醒，以及小學堂（到了時機的課，或每月一課）。 */
export async function POST(req: Request) {
  const key = process.env.CRON_SECRET;
  const h = (s: string) => createHash("sha256").update(s).digest();
  if (!key || !timingSafeEqual(h(req.headers.get("x-cron-key") ?? ""), h(key))) return new Response("Unauthorized", { status: 401 });
  const reminders = await sendReminders();
  const lessons = await sendLessons();
  return NextResponse.json({ reminders, lessons });
}
