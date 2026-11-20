// src/lib/moph-alert.ts

const MOPH_ALERT_BASE_URL = "https://morpromt2c.moph.go.th/alert/v3.1/messages";
const CLIENT_KEY = process.env.MOPH_ALERT_CLIENT_KEY;
const SECRET_KEY = process.env.MOPH_ALERT_SECRET_KEY;

export type MophAlertPayload = {
  cid: string[];
  messages: any[];
  message_title: string;
  message_html: string;
  message_text: string;
  message_type: string;
};

/**
 * ส่งข้อความไปยัง MOPH Alert API (v3.1)
 */
export async function sendMophAlert(payload: MophAlertPayload) {
  if (!CLIENT_KEY || !SECRET_KEY) {
    console.warn("MOPH Alert API keys not configured. Skipping alert.");
    return false;
  }

  try {
    const response = await fetch(MOPH_ALERT_BASE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "client-key": CLIENT_KEY,
        "secret-key": SECRET_KEY,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`MOPH Alert API Error: ${response.status} - ${errorText}`);
      return false;
    }

    const data = await response.json().catch(() => ({}));
    console.log("MOPH Alert Success:", data);

    return true;
  } catch (error) {
    console.error("MOPH Alert Request Failed:", error);
    return false;
  }
}

/**
 * สร้าง Flex Message สำหรับยืนยันลงเวลาเข้างาน
 */
export function getCheckInFlexMessage(timeString: string) {
  return {
    type: "flex",
    altText: "ยืนยันลงเวลาเข้างาน",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          {
            type: "image",
            url: "https://plkhealth.moph.go.th/www/wp-content/uploads/2025/08/moph-flex-header-1-1.png",
            size: "full",
            aspectRatio: "3120:885",
            aspectMode: "cover"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "คุณได้ลงเวลาเข้างานเรียบร้อยแล้ว",
            wrap: true,
            size: "sm",
            color: "#64748b"
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "เวลาบันทึก:",
                size: "sm",
                color: "#64748b",
                flex: 1
              },
              {
                type: "text",
                text: timeString,
                size: "sm",
                color: "#0f172a",
                weight: "bold",
                flex: 2,
                align: "end"
              }
            ],
            margin: "md"
          }
        ],
        paddingAll: "16px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ขอให้การปฏิบัติงานวันนี้ราบรื่น!",
            size: "xs",
            color: "#94a3b8",
            align: "center"
          }
        ],
        paddingAll: "12px"
      }
    }
  };
}

/**
 * สร้าง Flex Message สำหรับเตือนผู้ที่ยังไม่ได้ลงเวลาเข้างาน
 */
export function getCheckInReminderFlexMessage() {
  return {
    type: "flex",
    altText: "แจ้งเตือน: คุณยังไม่ได้ลงเวลาเข้างาน",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          {
            type: "image",
            url: "https://plkhealth.moph.go.th/www/wp-content/uploads/2025/08/moph-flex-header-1-1.png",
            size: "full",
            aspectRatio: "3120:885",
            aspectMode: "cover"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "คุณยังไม่ได้ลงเวลาเข้างาน (Check-in) สำหรับวันนี้",
            wrap: true,
            size: "sm",
            color: "#0f172a",
            weight: "bold"
          },
          {
            type: "text",
            text: "กรุณาเข้าไปลงเวลาในระบบ หากวันนี้ลาหรือไปราชการ กรุณาแจ้งที่เมนู แผนงานล่วงหน้ารายสัปดาห์",
            wrap: true,
            size: "sm",
            color: "#64748b",
            margin: "sm"
          }
        ],
        paddingAll: "16px"
      }
    }
  };
}

/**
 * สร้าง Flex Message สำหรับแจ้งเตือนการลงเวลาออกงาน
 */
export function getCheckOutReminderFlexMessage() {
  return {
    type: "flex",
    altText: "แจ้งเตือน: อย่าลืมลงเวลาออกงาน",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          {
            type: "image",
            url: "https://plkhealth.moph.go.th/www/wp-content/uploads/2025/08/moph-flex-header-1-1.png",
            size: "full",
            aspectRatio: "3120:885",
            aspectMode: "cover"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "คุณยังไม่ได้ลงเวลาออกงาน (Check-out) สำหรับวันนี้",
            wrap: true,
            size: "sm",
            color: "#0f172a",
            weight: "bold"
          },
          {
            type: "text",
            text: "กรุณาเข้าไปทำรายการในระบบเพื่อบันทึกข้อมูลการปฏิบัติงานของคุณให้สมบูรณ์",
            wrap: true,
            size: "sm",
            color: "#64748b",
            margin: "sm"
          }
        ],
        paddingAll: "16px"
      }
    }
  };
}

/**
 * สร้าง Flex Message สำหรับยืนยันลงเวลาออกงาน
 */
export function getCheckOutFlexMessage(timeString: string) {
  return {
    type: "flex",
    altText: "ยืนยันลงเวลาออกงาน",
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "vertical",
        paddingAll: "0px",
        contents: [
          {
            type: "image",
            url: "https://plkhealth.moph.go.th/www/wp-content/uploads/2025/08/moph-flex-header-1-1.png",
            size: "full",
            aspectRatio: "3120:885",
            aspectMode: "cover"
          }
        ]
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "คุณได้ลงเวลาออกงานเรียบร้อยแล้ว",
            wrap: true,
            size: "sm",
            color: "#64748b"
          },
          {
            type: "separator",
            margin: "md"
          },
          {
            type: "box",
            layout: "horizontal",
            contents: [
              {
                type: "text",
                text: "เวลาบันทึก:",
                size: "sm",
                color: "#64748b",
                flex: 1
              },
              {
                type: "text",
                text: timeString,
                size: "sm",
                color: "#0f172a",
                weight: "bold",
                flex: 2,
                align: "end"
              }
            ],
            margin: "md"
          }
        ],
        paddingAll: "16px"
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "ขอบคุณสำหรับการปฏิบัติงานในวันนี้",
            size: "xs",
            color: "#94a3b8",
            align: "center"
          }
        ],
        paddingAll: "12px"
      }
    }
  };
}
