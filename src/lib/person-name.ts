const tidy = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, " ");

/**
 * รวมคำนำหน้ากับชื่อ-สกุลภาษาไทย ชื่อจาก ProviderID บางคนมีคำนำหน้าอยู่แล้ว (เช่น "นาย นัฐพร")
 * จึงไม่ใส่ซ้ำ และให้คำนำหน้าติดกับชื่อแบบ "นายนัฐพร สุราษฎร์" คืนค่าว่างเมื่อไม่มีชื่อ
 */
export const formatThaiFullName = (title: string | null | undefined, name: string | null | undefined): string => {
  const cleanName = tidy(name);
  const cleanTitle = tidy(title);
  if (!cleanName) return "";
  if (!cleanTitle) return cleanName;
  if (cleanName.startsWith(cleanTitle)) {
    return cleanTitle + cleanName.slice(cleanTitle.length).trimStart();
  }
  return cleanTitle + cleanName;
};

/** คำนำหน้าที่พบบ่อย ใช้ตรวจเมื่อไม่มีคำนำหน้าแยกมา (เรียงยาวไปสั้น เพื่อไม่ให้ "นาง" ตัด "นางสาว") */
const COMMON_TITLES = ["นางสาว", "นาง", "นาย"];

/**
 * แยกคำนำหน้าออกจากชื่อที่ได้จาก SSO (ThaiD ส่ง claim "name" มาพร้อมคำนำหน้า เช่น "นาย นัฐพร สุราษฎร์")
 * เพื่อเก็บ name_th เป็นชื่อ-สกุลล้วน และ title_th แยกไว้ ไม่ว่าจะเข้าสู่ระบบช่องทางใด
 */
export const splitThaiTitle = (
  name: string | null | undefined,
  title: string | null | undefined,
): { title: string | undefined; name: string | undefined } => {
  const cleanName = tidy(name) || undefined;
  const cleanTitle = tidy(title) || undefined;
  if (!cleanName) return { title: cleanTitle, name: undefined };

  if (cleanTitle && cleanName.startsWith(cleanTitle)) {
    // คำนำหน้า "นาง" ไม่ใช่ส่วนต้นของ "นางสาวกนกพร"
    const startsWithLongerTitle = COMMON_TITLES.some(
      (common) => common.length > cleanTitle.length && common.startsWith(cleanTitle) && cleanName.startsWith(common),
    );
    if (!startsWithLongerTitle) {
      return { title: cleanTitle, name: cleanName.slice(cleanTitle.length).trimStart() || cleanName };
    }
  }

  if (!cleanTitle) {
    const detected = COMMON_TITLES.find((common) => cleanName.startsWith(`${common} `));
    if (detected) return { title: detected, name: cleanName.slice(detected.length).trimStart() };
  }

  return { title: cleanTitle, name: cleanName };
};
