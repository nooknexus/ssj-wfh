// แจ้งเตือนเข้ากลุ่มผ่าน MorProm Notify (คนละบริการกับ MOPH Alert ใน moph-alert.ts ที่ส่งหารายบุคคล)

import { APP_CONFIG } from "@/lib/constants";

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

export type NewUserInfo = {
  titleTh?: string | null;
  nameTh?: string | null;
  nameEng?: string | null;
  position?: string | null;
  hname?: string | null;
  registeredAt: Date;
};

const formatThaiDateTime = (date: Date) =>
  new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

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

/** Flex Message แจ้งผู้ดูแลว่ามีผู้ใช้ใหม่ลงทะเบียนและรออนุมัติ */
export function buildNewUserFlex(user: NewUserInfo) {
  const fullName = [user.titleTh, user.nameTh].filter(Boolean).join("") || user.nameEng?.trim() || "";
  const rows = [
    detailRow("คำนำหน้าและชื่อ", fullName),
    detailRow("ตำแหน่ง", user.position),
    detailRow("หน่วยงาน", user.hname),
  ].filter((row) => row !== null);

  return {
    type: "flex",
    altText: `มีผู้ใช้ใหม่ลงทะเบียน: ${fullName || "ไม่ระบุชื่อ"}`,
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
              {
                type: "text",
                text: `👤 มีผู้ใช้ใหม่ลงทะเบียน บนระบบ ${APP_CONFIG.name}`,
                align: "center",
                color: "#2D2D2D",
                weight: "bold",
                size: "lg",
                wrap: true,
              },
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
          {
            type: "text",
            text: `ลงทะเบียนเมื่อ ${formatThaiDateTime(user.registeredAt)} น.`,
            size: "xs",
            color: "#999999",
            margin: "md",
            align: "center",
            wrap: true,
          },
        ],
      },
    },
  };
}
