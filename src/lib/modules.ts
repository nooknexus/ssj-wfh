/** โมดูลเปิดอยู่หรือไม่: ปิดเฉพาะเมื่อตั้งค่าเป็น "false" (ไม่มีค่า = เปิด) */
export const isModuleEnabled = (
  settings: Record<string, string> | undefined,
  moduleKey: string,
): boolean => settings?.[moduleKey] !== "false";

/** เมนูที่ไม่ได้ผูกกับโมดูล (เช่น แดชบอร์ด) แสดงเสมอ */
export const filterEnabledNavigation = <T extends { key: string }>(
  items: readonly T[],
  settings: Record<string, string> | undefined,
): T[] => items.filter((item) => !item.key.startsWith("module_") || isModuleEnabled(settings, item.key));
