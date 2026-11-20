import { NextResponse } from "next/server";
import { endOfDay, isWeekend, startOfDay } from "date-fns";
import { db } from "@/server/db";
import { sendMophAlert, getCheckInReminderFlexMessage } from "@/lib/moph-alert";
import { selectCheckInReminderCids } from "@/lib/checkin-reminder";
import { getThaiHolidaysForRange, isHoliday } from "@/server/utils/holidays";

// API สำหรับให้ Cron Job ภายนอกยิงเข้ามา (เช่น ตั้งเวลา 09:00 น. ของทุกวันทำการ)
export async function GET(request: Request) {
  // ตรวจสอบ Authorization Token: ถ้ายังไม่ได้ตั้ง CRON_SECRET ให้ปฏิเสธทุกคำขอ (กันกรณี "Bearer undefined")
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const enabledSetting = await db.systemSetting.findUnique({
      where: { setting_key: "moph_alert_checkin_reminder_enabled" },
    });
    if (enabledSetting && enabledSetting.setting_value !== "true") {
      return NextResponse.json({ success: true, message: "Check-in reminder is disabled in system settings." });
    }

    const today = new Date();
    // กันกรณี cron ตั้งรวมวันหยุด: เสาร์-อาทิตย์และวันหยุดนักขัตฤกษ์ไม่ต้องเตือน
    if (isWeekend(today) || isHoliday(today, await getThaiHolidaysForRange(today, today))) {
      return NextResponse.json({ success: true, notified_count: 0, message: "Today is not a working day." });
    }

    const start = startOfDay(today);
    const end = endOfDay(today);
    const [users, records, leaves, exceptions] = await Promise.all([
      db.user.findMany({ where: { status: "active" }, select: { id: true, username: true } }),
      db.attendanceRecord.findMany({ where: { date: { gte: start, lte: end } }, select: { user_id: true } }),
      db.leaveRequest.findMany({
        where: { step2_status: "approved", start_date: { lte: end }, end_date: { gte: start } },
        select: { user_id: true },
      }),
      db.attendanceException.findMany({
        where: { status: "approved", date: { gte: start, lte: end } },
        select: { user_id: true, period: true },
      }),
    ]);

    const cids = selectCheckInReminderCids({
      users,
      checkedInUserIds: records.map((record) => record.user_id),
      onLeaveUserIds: leaves.flatMap((leave) => (leave.user_id == null ? [] : [leave.user_id])),
      exceptions,
    });

    if (cids.length > 0) {
      console.log(`Sending check-in reminder to ${cids.length} users...`);
      await sendMophAlert({
        cid: cids,
        messages: [getCheckInReminderFlexMessage()],
        message_title: "แจ้งเตือน: คุณยังไม่ได้ลงเวลาเข้างาน",
        message_html: "<div><strong>ประกาศแจ้งเตือน: คุณยังไม่ได้ลงเวลาเข้างาน (Check-in)</strong></div>",
        message_text: "คุณยังไม่ได้ลงเวลาเข้างาน (Check-in) สำหรับวันนี้ กรุณาเข้าไปลงเวลาในระบบ หากลาหรือไปราชการ กรุณาแจ้งที่แผนงานล่วงหน้ารายสัปดาห์",
        message_type: "HPT",
      });
    }

    return NextResponse.json({ success: true, notified_count: cids.length, message: "Check-in reminders executed successfully" });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
