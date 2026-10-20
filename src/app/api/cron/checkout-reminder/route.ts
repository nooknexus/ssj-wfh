import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { sendMophAlert, getCheckOutReminderFlexMessage } from "@/lib/moph-alert";
import { skipsCheckoutReminder } from "@/lib/attendance-exception";
import { findApprovedExceptionForDay } from "@/server/services/attendance-exception";

// API สำหรับให้ Cron Job ภายนอกยิงเข้ามา (เช่น ตั้งเวลา 17:00 น. ของทุกวันทำการ)
export async function GET(request: Request) {
  // ตรวจสอบ Authorization Token: ถ้ายังไม่ได้ตั้ง CRON_SECRET ให้ปฏิเสธทุกคำขอ (กันกรณี "Bearer undefined")
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ตรวจสอบว่าระบบแจ้งเตือนถูกปิดไว้หรือไม่
    const reminderEnabledSetting = await db.systemSetting.findUnique({
      where: { setting_key: "moph_alert_reminder_enabled" }
    });
    const isReminderAlertEnabled = reminderEnabledSetting ? reminderEnabledSetting.setting_value === "true" : true;

    if (!isReminderAlertEnabled) {
      console.log("Checkout reminder alert is disabled in settings. Skip execution.");
      return NextResponse.json({ 
        success: true, 
        message: "Checkout reminder is disabled in system settings."
      });
    }

    // ปรับวันนี้เป็นเที่ยงวันเพื่อหาจุดเริ่มต้นวัน (กัน Timezone Issue)
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    
    // คำนวณเวลาเริ่มและสิ้นสุดวัน
    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setHours(23, 59, 59, 999);

    // ดึงข้อมูลพนักงานที่เข้างานวันนี้ แต่ยังไม่ได้ออกงาน
    const records = await db.attendanceRecord.findMany({
      where: {
        date: {
          gte: start,
          lte: end,
        },
        check_out_time: null,
      },
      include: {
        user: true,
      },
    });

    // ไม่เตือนผู้ที่ได้รับอนุมัติลา/ไปราชการครึ่งบ่ายหรือเต็มวัน
    const exceptions = await Promise.all(
      records.map((r) => findApprovedExceptionForDay(db, r.user_id, today)),
    );
    const cids = records
      .filter((_, index) => !skipsCheckoutReminder(exceptions[index]?.period))
      .map(r => r.user.username)
      .filter((cid): cid is string => Boolean(cid && cid.length === 13));

    if (cids.length > 0) {
      console.log(`Sending checkout reminder to ${cids.length} users...`);
      
      const payload = {
        cid: cids,
        messages: [getCheckOutReminderFlexMessage()],
        message_title: "แจ้งเตือน: อย่าลืมลงเวลาออกงาน",
        message_html: "<div><strong>ประกาศแจ้งเตือน: อย่าลืมลงเวลาออกงาน (Check-out)</strong></div>",
        message_text: "คุณยังไม่ได้ลงเวลาออกงาน (Check-out) สำหรับวันนี้ กรุณาเข้าไปทำรายการในระบบเพื่อบันทึกประวัติให้สมบูรณ์",
        message_type: "HPT"
      };

      await sendMophAlert(payload);
    } else {
      console.log("No users found missing check-out. Skip sending alert.");
    }

    return NextResponse.json({ 
      success: true, 
      notified_count: cids.length,
      message: "Checkout reminders executed successfully"
    });
  } catch (error) {
    console.error("Cron Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
