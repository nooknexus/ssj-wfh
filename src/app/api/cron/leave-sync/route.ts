import { NextResponse } from "next/server";
import { runLeaveSync } from "@/server/services/leave-sync";

// Sync ใบลาจาก MySQL ของระบบลา ให้ Cron Job ภายนอกเรียกตามเวลา (ดู DEPLOY.md)
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runLeaveSync("cron");
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Leave sync failed";
    console.error("Leave sync cron error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
