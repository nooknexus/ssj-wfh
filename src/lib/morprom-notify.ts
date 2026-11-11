// แจ้งเตือนเข้ากลุ่มผ่าน MorProm Notify (คนละบริการกับ MOPH Alert ใน moph-alert.ts ที่ส่งหารายบุคคล)

import { APP_CONFIG } from "@/lib/constants";
import { PLATFORM_LABELS, type ConferencePlatform } from "@/lib/conference-booking";

const MORPROM_NOTIFY_URL = "https://morpromt2f.moph.go.th/api/notify/send";
const FLEX_HEADER_IMAGE = "https://plkhealth.moph.go.th/www/wp-content/uploads/2025/08/moph-flex-header-1-1.png";

export type MorPromNotifyPayload = { messages: unknown[] };

/** ส่งข้อความ คืน false เมื่อยังไม่ได้ตั้งค่าหรือส่งไม่สำเร็จ (ไม่ throw เพื่อไม่ให้กระทบงานหลัก) */
export async function sendMorPromNotify(payload: MorPromNotifyPayload): Promise<boolean> {
  const clientKey = process.env.MORPROM_NOTIFY_CLIENT_KEY?.trim();
  const secretKey = process.env.MORPROM_NOTIFY_SECRET_KEY?.trim();
  if (!clientKey || !secretKey) {
    console.warn("MorProm Notify keys not configured. Skipping notification.");
    return false;
  }

  try {
    const response = await fetch(MORPROM_NOTIFY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-key": clientKey,
        "secret-key": secretKey,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      console.error(`MorProm Notify Error: ${response.status} - ${await response.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("MorProm Notify Request Failed:", error);
    return false;
  }
}

const thaiDate = (date: Date, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", ...options }).format(date);
const formatThaiDate = (date: Date) => thaiDate(date, { day: "numeric", month: "short", year: "numeric" });
const formatTime = (date: Date) => thaiDate(date, { hour: "2-digit", minute: "2-digit" });
const formatThaiDateTime = (date: Date) => `${formatThaiDate(date)} ${formatTime(date)}`;

/** ช่วงเวลาประชุม: วันเดียวกันแสดงวันครั้งเดียว ข้ามวันแสดงทั้งสองวัน */
const formatThaiRange = (start: Date, end: Date) =>
  formatThaiDate(start) === formatThaiDate(end)
    ? `${formatThaiDate(start)} เวลา ${formatTime(start)}–${formatTime(end)} น.`
    : `${formatThaiDateTime(start)} – ${formatThaiDateTime(end)} น.`;

const detailRow = (label: string, value?: string | null) =>
  value?.trim()
    ? {
        type: "box",
        layout: "vertical",
        spacing: "xs",
        margin: "md",
        contents: [
          { type: "text", text: label, color: "#888888", size: "xs", weight: "bold", wrap: true },
          { type: "text", text: value.trim(), color: "#333333", size: "sm", wrap: true },
        ],
      }
    : null;

/** Flex Message แบบ "รอผู้ดูแลอนุมัติ": หัวข้อ, รายละเอียด (เฉพาะช่องที่มีข้อมูล), กล่องสีส้ม และเวลาที่ footer */
const pendingApprovalFlex = ({
  altText,
  title,
  details,
  footerText,
}: {
  altText: string;
  title: string;
  details: Array<[label: string, value: string | null | undefined]>;
  footerText: string;
}) => {
  const rows = details.map(([label, value]) => detailRow(label, value)).filter((row) => row !== null);

  return {
    type: "flex",
    altText,
    contents: {
      type: "bubble",
      size: "mega",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          { type: "image", url: FLEX_HEADER_IMAGE, size: "full", aspectMode: "cover", aspectRatio: "3120:885" },
        ],
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "box",
            layout: "vertical",
            backgroundColor: "#DCE7FF",
            cornerRadius: "15px",
            paddingAll: "16px",
            contents: [
              { type: "text", text: title, align: "center", color: "#2D2D2D", weight: "bold", size: "lg", wrap: true },
            ],
          },
          ...(rows.length ? [{ type: "box", layout: "vertical", spacing: "xs", margin: "lg", contents: rows }] : []),
          {
            type: "box",
            layout: "vertical",
            margin: "lg",
            paddingAll: "12px",
            backgroundColor: "#FFF4E5",
            cornerRadius: "10px",
            contents: [{ type: "text", text: "⏳ รอผู้ดูแลอนุมัติ", weight: "bold", color: "#B26A00", size: "sm", align: "center" }],
          },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "separator", margin: "md" },
          { type: "text", text: footerText, size: "xs", color: "#999999", margin: "md", align: "center", wrap: true },
        ],
      },
    },
  };
};

export type NewUserInfo = {
  titleTh?: string | null;
  nameTh?: string | null;
  nameEng?: string | null;
  position?: string | null;
  hname?: string | null;
  registeredAt: Date;
};

/** แจ้งผู้ดูแลว่ามีผู้ใช้ใหม่ลงทะเบียนและรออนุมัติ */
export function buildNewUserFlex(user: NewUserInfo) {
  const fullName = [user.titleTh, user.nameTh].filter(Boolean).join("") || user.nameEng?.trim() || "";

  return pendingApprovalFlex({
    altText: `มีผู้ใช้ใหม่ลงทะเบียน: ${fullName || "ไม่ระบุชื่อ"}`,
    title: `👤 มีผู้ใช้ใหม่ลงทะเบียน บนระบบ ${APP_CONFIG.name}`,
    details: [
      ["คำนำหน้าและชื่อ", fullName],
      ["ตำแหน่ง", user.position],
      ["หน่วยงาน", user.hname],
    ],
    footerText: `ลงทะเบียนเมื่อ ${formatThaiDateTime(user.registeredAt)} น.`,
  });
}

export type BookingPendingInfo = {
  title: string;
  linkName: string;
  platform: ConferencePlatform;
  startAt: Date;
  endAt: Date;
  attendees?: number | null;
  requesterName?: string | null;
  departmentName?: string | null;
  bookedAt: Date;
};

/** แจ้งผู้ดูแล IT ว่ามีการจอง Web Conference รออนุมัติ (ไม่ใส่ URL ห้องประชุม ซึ่งเปิดเผยหลังอนุมัติเท่านั้น) */
export function buildBookingPendingFlex(booking: BookingPendingInfo) {
  return pendingApprovalFlex({
    altText: `มีการจอง Web Conference รออนุมัติ: ${booking.title}`,
    title: "📹 มีการจอง Web Conference รออนุมัติ",
    details: [
      ["หัวข้อการประชุม", booking.title],
      ["ลิงก์", `${booking.linkName} (${PLATFORM_LABELS[booking.platform]})`],
      ["วันและเวลา", formatThaiRange(booking.startAt, booking.endAt)],
      ["จำนวนผู้เข้าร่วม", booking.attendees ? `${booking.attendees} คน` : null],
      ["ผู้จอง", booking.requesterName],
      ["กลุ่มงาน", booking.departmentName],
    ],
    footerText: `จองเมื่อ ${formatThaiDateTime(booking.bookedAt)} น.`,
  });
}
