const tidy = (value: string | null | undefined) => (value ?? "").trim().replace(/\s+/g, " ");

/** คำนำหน้าแบบเต็ม (เรียงยาวไปสั้น เพื่อไม่ให้ "นาง" ตัด "นางสาว") */
const FULL_TITLES = ["นางสาว", "นาง", "นาย"];

/** คำนำหน้าแบบย่อที่พบในชื่อจาก SSO และคำนำหน้าแบบเต็มที่ตรงกัน */
const ABBREVIATED_TITLES: Record<string, string> = {
  "น.ส.": "นางสาว",
  "นส.": "นางสาว",
};

/** สระ/วรรณยุกต์ที่ขึ้นต้นคำไม่ได้: ถ้าตามหลังคำนำหน้า แปลว่าเป็นส่วนหนึ่งของชื่อ (เช่น "นายิกา") */
const startsWithCombiningMark = (text: string) => /^[ัิ-ฺ็-๎]/.test(text);

/** ตัดคำนำหน้าที่อยู่ต้นชื่อ คืน null ถ้าต้นชื่อไม่ใช่คำนำหน้า */
const stripLeadingTitle = (name: string, title: string): string | null => {
  if (!name.startsWith(title)) return null;
  const rest = name.slice(title.length);
  // คำนำหน้า "นาง" ไม่ใช่ส่วนต้นของ "นางสาวกนกพร"
  const longerTitle = FULL_TITLES.some((full) => full.length > title.length && full.startsWith(title) && name.startsWith(full));
  if (longerTitle || startsWithCombiningMark(rest)) return null;
  return rest.trimStart() || null;
};

/**
 * แยกคำนำหน้าออกจากชื่อที่ได้จาก SSO (ThaiD ส่ง claim "name" มาพร้อมคำนำหน้า เช่น "นาย นัฐพร สุราษฎร์"
 * หรือแบบย่อ "น.ส. กมลฉัตร") เพื่อเก็บ name_th เป็นชื่อ-สกุลล้วน และ title_th แบบเต็มแยกไว้
 */
export const splitThaiTitle = (
  name: string | null | undefined,
  title: string | null | undefined,
): { title: string | undefined; name: string | undefined } => {
  const cleanName = tidy(name) || undefined;
  const cleanTitle = tidy(title) || undefined;
  if (!cleanName) return { title: cleanTitle, name: undefined };

  if (cleanTitle) {
    const rest = stripLeadingTitle(cleanName, cleanTitle);
    if (rest) return { title: cleanTitle, name: rest };
  }

  // คำนำหน้าแบบย่อ ("น.ส.") ตัดได้แม้ไม่มีช่องว่างตามหลัง เพราะลงท้ายด้วยจุด
  for (const [abbreviation, fullTitle] of Object.entries(ABBREVIATED_TITLES)) {
    const rest = stripLeadingTitle(cleanName, abbreviation);
    if (rest) return { title: cleanTitle ?? fullTitle, name: rest };
  }

  // คำนำหน้าแบบเต็มที่ไม่ตรงกับ title ที่ส่งมา: ตัดเฉพาะเมื่อมีช่องว่างตามหลัง
  const detected = FULL_TITLES.find((full) => cleanName.startsWith(`${full} `));
  if (detected) return { title: cleanTitle ?? detected, name: cleanName.slice(detected.length).trimStart() };

  return { title: cleanTitle, name: cleanName };
};

/**
 * รวมคำนำหน้ากับชื่อ-สกุลภาษาไทย โดยไม่ใส่คำนำหน้าซ้ำ (ชื่อเก่าบางคนมีคำนำหน้าเต็มหรือแบบย่อติดอยู่)
 * และให้คำนำหน้าติดกับชื่อแบบ "นายนัฐพร สุราษฎร์" คืนค่าว่างเมื่อไม่มีชื่อ
 */
export const formatThaiFullName = (title: string | null | undefined, name: string | null | undefined): string => {
  const split = splitThaiTitle(name, title);
  if (!split.name) return "";
  if (!split.title) return split.name;
  // ชื่อยังขึ้นต้นด้วยคำนำหน้าที่ยาวกว่า (คำนำหน้า "นาง" แต่ชื่อเป็น "นางสาวกนกพร") ใช้ตามชื่อ
  if (FULL_TITLES.some((full) => full.startsWith(split.title!) && split.name!.startsWith(full) && full !== split.title)) {
    return split.name;
  }
  return split.title + split.name;
};
