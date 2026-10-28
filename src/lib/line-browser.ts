/** พารามิเตอร์ที่ LINE ใช้สั่งให้เปิด URL ใน browser ภายนอกแทน browser ในแอป LINE */
export const OPEN_EXTERNAL_BROWSER_PARAM = "openExternalBrowser";

/** browser ในแอป LINE ใส่ "Line/<version>" ไว้ใน User-Agent (ระวังไม่ให้ชนกับ "Linux") */
export const isLineInAppBrowser = (userAgent: string | null | undefined): boolean =>
  Boolean(userAgent && /\bLine\/\d/.test(userAgent));

/** เปิดจาก LINE และยังไม่ได้สั่งเปิด browser ภายนอก: ควร redirect ไปหน้าเดิมพร้อมพารามิเตอร์ */
export const shouldOpenExternalBrowser = (
  method: string,
  userAgent: string | null | undefined,
  searchParams: URLSearchParams,
): boolean =>
  (method === "GET" || method === "HEAD") &&
  isLineInAppBrowser(userAgent) &&
  searchParams.get(OPEN_EXTERNAL_BROWSER_PARAM) !== "1";
