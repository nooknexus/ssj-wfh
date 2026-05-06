import { startOfDay, isSameDay } from 'date-fns';

// ---------------------------------------------------------------------------
// Thai Public Holidays via Google Calendar ICS (ไม่ต้องใช้ API Key)
// ---------------------------------------------------------------------------
// ดึงวันหยุดนักขัตฤกษ์ไทยจาก Google Calendar สาธารณะ
// Calendar ID: en.th#holiday@group.v.calendar.google.com
// ไม่ต้องการ authentication ใดๆ เพราะเป็น public calendar
// ---------------------------------------------------------------------------

const ICS_URL =
  `https://calendar.google.com/calendar/ical/${encodeURIComponent("en.th#holiday@group.v.calendar.google.com")}/public/basic.ics`;

// ---------------------------------------------------------------------------
// Fallback — Static Thai Holidays (ใช้เมื่อ network ไม่พร้อมใช้งาน)
// ---------------------------------------------------------------------------
const THAI_HOLIDAYS_FALLBACK: Record<number, string[]> = {
  2025: [
    "20250101", "20250102", "20250212", "20250406", "20250413",
    "20250414", "20250415", "20250504", "20250512",
    "20250513", "20250603", "20250710", "20250711", "20250728",
    "20250812", "20251013", "20251023", "20251205", "20251210", "20251231",
  ],
  2026: [
    "20260101", "20260102", "20260303", "20260406", "20260413",
    "20260414", "20260415", "20260504", "20260513", "20260531",
    "20260601", "20260603", "20260728", "20260729", "20260730",
    "20260812", "20261013", "20261023", "20261205", "20261207",
    "20261210", "20261231",
  ],
};

// ---------------------------------------------------------------------------
// ICS Text Parser (lightweight — ไม่ใช้ node-ical ซึ่งมี BigInt ทำให้ crash)
// ---------------------------------------------------------------------------

/** Parse date string จาก ICS format "YYYYMMDD" หรือ "YYYYMMDDTHHmmssZ" */
function parseICSDateString(dateStr: string): Date | null {
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const [, yr, mo, dy] = match.map(Number);
  // new Date(yr, mo-1, dy) → local date (ป้องกัน timezone shift UTC+7)
  return startOfDay(new Date(yr, mo - 1, dy));
}

/** Parse ICS text → รายการ Date ของทุก VEVENT */
function parseICS(icsText: string): Date[] {
  const holidays: Date[] = [];
  const blocks = icsText.split("BEGIN:VEVENT");
  for (let i = 1; i < blocks.length; i++) {
    const dtStartMatch = blocks[i].match(/DTSTART(?:;[^:]+)?:([^\r\n]+)/);
    if (dtStartMatch) {
      const parsed = parseICSDateString(dtStartMatch[1].trim());
      if (parsed) {
        // ยกเว้นวันแรงงานแห่งชาติ (1 พฤษภาคม) ของทุกปี
        const isLaborDay = parsed.getMonth() === 4 && parsed.getDate() === 1;
        if (!isLaborDay) {
          holidays.push(parsed);
        }
      }
    }
  }
  return holidays;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------
/** Cache เก็บวันหยุดทั้งหมด (ทุกปีรวมกัน) พร้อม timestamp ที่ดึงมา */
let icsCache: { holidays: Date[]; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 ชั่วโมง

/** ดึง fallback จาก static data สำหรับปีที่ระบุ */
function getFallbackForYears(years: number[]): Date[] {
  return years.flatMap((year) => {
    const strs = THAI_HOLIDAYS_FALLBACK[year];
    if (!strs) {
      console.warn(`[holidays] No fallback data for year ${year}. Update THAI_HOLIDAYS_FALLBACK.`);
      return [];
    }
    return strs.map((s) => parseICSDateString(s)!).filter(Boolean);
  });
}

/** ดึงและ parse ICS จาก Google Calendar */
async function fetchAllHolidays(): Promise<Date[]> {
  try {
    const res = await fetch(ICS_URL, {
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const icsText = await res.text();
    const holidays = parseICS(icsText);
    console.log(`[holidays] Fetched ${holidays.length} holidays from Google Calendar ICS.`);
    return holidays;
  } catch (err) {
    console.error("[holidays] ICS fetch failed:", err);
    console.warn("[holidays] Using static fallback data.");
    return null as unknown as Date[]; // handled below
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * ดึงวันหยุดนักขัตฤกษ์ไทยที่ครอบคลุมช่วง startDate–endDate
 * ดึง ICS ทั้งหมดครั้งเดียวแล้ว cache 24 ชั่วโมง
 * Fallback อัตโนมัติถ้า network ไม่พร้อม
 */
export async function getThaiHolidaysForRange(
  startDate: Date,
  endDate: Date
): Promise<Date[]> {
  // ใช้ cache ถ้ายังไม่หมดอายุ
  if (icsCache && Date.now() - icsCache.fetchedAt < CACHE_TTL_MS) {
    return filterByRange(icsCache.holidays, startDate, endDate);
  }

  const fetched = await fetchAllHolidays();
  if (fetched !== null) {
    icsCache = { holidays: fetched, fetchedAt: Date.now() };
    return filterByRange(fetched, startDate, endDate);
  }

  // Fallback: ใช้ static data ตามปีที่ต้องการ
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const years = Array.from({ length: endYear - startYear + 1 }, (_, i) => startYear + i);
  const fallback = getFallbackForYears(years);
  // Cache fallback ด้วย แต่ TTL สั้นกว่า (1 ชั่วโมง) เพื่อ retry เร็วขึ้น
  icsCache = { holidays: fallback, fetchedAt: Date.now() - CACHE_TTL_MS + 1000 * 60 * 60 };
  return filterByRange(fallback, startDate, endDate);
}

/** กรองวันหยุดให้อยู่ในช่วง startDate–endDate */
function filterByRange(holidays: Date[], startDate: Date, endDate: Date): Date[] {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  return holidays.filter((h) => h >= start && h <= end);
}

/**
 * ดึงวันหยุดสำหรับปีปัจจุบัน (backward-compat)
 */
export async function getThaiHolidays(): Promise<Date[]> {
  const now = new Date();
  return getThaiHolidaysForRange(now, now);
}

/**
 * ตรวจสอบว่าวันที่ระบุเป็นวันหยุดนักขัตฤกษ์หรือไม่
 */
export function isHoliday(date: Date, holidays: Date[]): boolean {
  const target = startOfDay(date);
  return holidays.some((h) => isSameDay(h, target));
}
