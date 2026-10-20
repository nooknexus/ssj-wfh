import mysql from "mysql2/promise";
import { subDays } from "date-fns";
import { db } from "../db";
import {
  LEAVE_SOURCE,
  assertSqlIdentifier,
  pickExternalName,
  parseLastLeaveSync,
  summarizeLeaveSync,
  type LastLeaveSync,
  type LeaveSyncTrigger,
  transformRemoteLeave,
  type LeaveRecordInput,
  type RemoteLeaveRow,
} from "@/lib/leave-source";

type LeaveSourceConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  leaveTypeNameColumn: string;
  daysBack: number;
};

export type LeaveSyncResult = {
  fetchedCount: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  failedCount: number;
  linkedCount: number;
};

/** อ่านค่าเชื่อมต่อ MySQL ของระบบลาจาก .env */
export const getLeaveSourceConfig = (): LeaveSourceConfig => {
  const { LEAVE_DB_HOST, LEAVE_DB_USER, LEAVE_DB_NAME } = process.env;
  if (!LEAVE_DB_HOST || !LEAVE_DB_USER || !LEAVE_DB_NAME) {
    throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมต่อฐานข้อมูลระบบลา (LEAVE_DB_HOST, LEAVE_DB_USER, LEAVE_DB_NAME) ใน .env");
  }
  return {
    host: LEAVE_DB_HOST,
    port: Number(process.env.LEAVE_DB_PORT) || 3306,
    user: LEAVE_DB_USER,
    password: process.env.LEAVE_DB_PASSWORD ?? "",
    database: LEAVE_DB_NAME,
    leaveTypeNameColumn: assertSqlIdentifier(process.env.LEAVE_DB_LEAVE_TYPE_NAME_COLUMN || "name", "LEAVE_DB_LEAVE_TYPE_NAME_COLUMN"),
    daysBack: Number(process.env.LEAVE_SYNC_DAYS_BACK) || 365,
  };
};

/** ดึงใบลาจาก MySQL ต้นทาง เฉพาะรายการที่สิ้นสุดภายในช่วง LEAVE_SYNC_DAYS_BACK วันที่ผ่านมาเป็นต้นไป */
const fetchRemoteLeaves = async (config: LeaveSourceConfig): Promise<RemoteLeaveRow[]> => {
  const connection = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectTimeout: 10_000,
    dateStrings: true,
    supportBigNumbers: true,
    bigNumberStrings: true,
    charset: "utf8mb4",
  });
  try {
    const since = subDays(new Date(), config.daysBack).toISOString().slice(0, 10);
    const [rows] = await connection.query(
      {
        sql: `SELECT lr.id, lr.cid, lr.external_name, lt.\`${config.leaveTypeNameColumn}\` AS leave_type_name,
                lr.start_date, lr.end_date, lr.total_days, lr.reason, lr.status, lr.step1_status, lr.step2_status
              FROM leave_requests lr
              LEFT JOIN leave_types lt ON lt.id = lr.leave_type_id
              WHERE lr.end_date >= ?
              ORDER BY lr.id`,
        timeout: 60_000,
      },
      [since],
    );
    return rows as RemoteLeaveRow[];
  } finally {
    await connection.end();
  }
};

const findUser = async (data: LeaveRecordInput) => {
  if (data.cid) {
    const byCid = await db.user.findFirst({ where: { OR: [{ username: data.cid }, { hash_cid: data.cid }] } });
    if (byCid) return byCid;
  }
  return data.fullName ? db.user.findFirst({ where: { name_th: { contains: data.fullName } } }) : null;
};

const leaveTypeCache = new Map<string, number>();

const resolveLeaveTypeId = async (name: string): Promise<number> => {
  const cached = leaveTypeCache.get(name);
  if (cached) return cached;
  const existing = await db.leaveType.findFirst({ where: { name } });
  const type = existing ?? (await db.leaveType.create({ data: { name, code: `SYNC_${name}`.substring(0, 20) } }));
  leaveTypeCache.set(name, type.id);
  return type.id;
};

/** รายการเดิม: ตาม source id ก่อน ถ้าไม่พบให้หารายการที่เคยนำเข้าจาก Google Sheet (ยังไม่มี source) ด้วย CID + ช่วงวันที่ */
const findExistingLeave = async (data: LeaveRecordInput, userId: number | undefined) => {
  const bySource = await db.leaveRequest.findUnique({
    where: { source_source_record_id: { source: LEAVE_SOURCE, source_record_id: data.sourceRecordId } },
    select: { id: true, user_id: true, external_name: true },
  });
  if (bySource) return bySource;
  const identity = [data.cid ? { cid: data.cid } : null, userId ? { user_id: userId } : null].filter(
    (item): item is { cid: string } | { user_id: number } => item !== null,
  );
  if (identity.length === 0) return null;
  return db.leaveRequest.findFirst({
    where: { source: null, start_date: data.startDate, end_date: data.endDate, OR: identity },
    select: { id: true, user_id: true, external_name: true },
  });
};

const saveLeave = async (data: LeaveRecordInput): Promise<"created" | "updated"> => {
  const user = await findUser(data);
  const existing = await findExistingLeave(data, user?.id);
  const fields = {
    user_id: existing?.user_id ?? user?.id ?? null,
    external_name: pickExternalName(Boolean(user), data.fullName, existing?.external_name),
    cid: data.cid,
    leave_type_id: await resolveLeaveTypeId(data.leaveTypeName),
    start_date: data.startDate,
    end_date: data.endDate,
    total_days: data.totalDays,
    reason: data.reason,
    status: data.status,
    step1_status: data.step1Status,
    step2_status: data.step2Status,
    source: LEAVE_SOURCE,
    source_record_id: data.sourceRecordId,
  };
  if (existing) {
    await db.leaveRequest.update({ where: { id: existing.id }, data: fields });
    return "updated";
  }
  await db.leaveRequest.create({ data: fields });
  return "created";
};

/** Sync ใบลาจาก MySQL ของระบบลามาเก็บใน leave_requests ของระบบนี้ */
export async function syncLeavesFromSource(): Promise<LeaveSyncResult> {
  const rows = await fetchRemoteLeaves(getLeaveSourceConfig());
  const result: LeaveSyncResult = {
    fetchedCount: rows.length,
    createdCount: 0,
    updatedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    linkedCount: 0,
  };
  leaveTypeCache.clear();

  for (const row of rows) {
    const transformed = transformRemoteLeave(row);
    if (!transformed.ok) {
      result.skippedCount++;
      continue;
    }
    try {
      const outcome = await saveLeave(transformed.data);
      result[outcome === "created" ? "createdCount" : "updatedCount"]++;
    } catch (error) {
      result.failedCount++;
      console.error(`Leave sync failed for source id ${transformed.data.sourceRecordId}:`, error);
    }
  }

  result.linkedCount = await relinkUnlinkedLeaves();
  return result;
}

/** ผูกใบลาที่ยังไม่มี user_id กับผู้ใช้ที่ลงทะเบียนภายหลัง โดยใช้ CID */
async function relinkUnlinkedLeaves(): Promise<number> {
  const unlinked = await db.leaveRequest.findMany({
    where: { user_id: null, cid: { not: null } },
    select: { id: true, cid: true },
  });

  let linkedCount = 0;
  for (const leave of unlinked) {
    if (!leave.cid) continue;
    const user = await db.user.findFirst({
      where: { OR: [{ username: leave.cid }, { hash_cid: leave.cid }] },
      select: { id: true },
    });
    if (user) {
      await db.leaveRequest.update({ where: { id: leave.id }, data: { user_id: user.id } });
      linkedCount++;
    }
  }
  return linkedCount;
}

const LOCK_KEY = "leave_sync_lock";
const LAST_SYNC_KEY = "leave_sync_last";
/** ถ้า Sync ค้างเกินเวลานี้ (เช่น server ล่มกลางทาง) ให้ถือว่าล็อกหมดอายุ */
const LOCK_TTL_MS = 10 * 60 * 1000;

/** จองสิทธิ์ Sync แบบ atomic: สำเร็จเฉพาะเมื่อไม่มีใครถือล็อก หรือล็อกเดิมหมดอายุแล้ว */
const acquireSyncLock = async (): Promise<boolean> => {
  await db.systemSetting.upsert({
    where: { setting_key: LOCK_KEY },
    update: {},
    create: { setting_key: LOCK_KEY, setting_value: "" },
  });
  const now = new Date();
  const cutoff = new Date(now.getTime() - LOCK_TTL_MS).toISOString();
  const { count } = await db.systemSetting.updateMany({
    where: { setting_key: LOCK_KEY, OR: [{ setting_value: "" }, { setting_value: { lt: cutoff } }] },
    data: { setting_value: now.toISOString() },
  });
  return count === 1;
};

const releaseSyncLock = () =>
  db.systemSetting.update({ where: { setting_key: LOCK_KEY }, data: { setting_value: "" } });

const saveLastSync = (value: LastLeaveSync) =>
  db.systemSetting.upsert({
    where: { setting_key: LAST_SYNC_KEY },
    update: { setting_value: JSON.stringify(value) },
    create: { setting_key: LAST_SYNC_KEY, setting_value: JSON.stringify(value) },
  });

export const getLastLeaveSync = async (): Promise<LastLeaveSync | null> => {
  const setting = await db.systemSetting.findUnique({ where: { setting_key: LAST_SYNC_KEY } });
  return parseLastLeaveSync(setting?.setting_value);
};

/** Sync พร้อมกันซ้อนไม่ได้ และบันทึกผลครั้งล่าสุด (ทั้งสำเร็จและล้มเหลว) ไว้แสดงในหน้า /admin/leaves */
export const runLeaveSync = async (trigger: LeaveSyncTrigger): Promise<LeaveSyncResult> => {
  if (!(await acquireSyncLock())) {
    throw new Error("กำลัง Sync ข้อมูลอยู่ กรุณารอสักครู่แล้วลองใหม่");
  }
  try {
    const result = await syncLeavesFromSource();
    await saveLastSync({ at: new Date().toISOString(), trigger, ok: result.failedCount === 0, message: summarizeLeaveSync(result) });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sync ไม่สำเร็จ";
    await saveLastSync({ at: new Date().toISOString(), trigger, ok: false, message });
    throw error;
  } finally {
    await releaseSyncLock();
  }
};
