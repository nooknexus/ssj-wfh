import mysql from "mysql2/promise";
import { getLeaveSourceConfig } from "./leave-sync";

export type PersonnelTypeLookup =
  | { available: true; typeByCid: Map<string, string> }
  | { available: false; reason: string };

/**
 * ประเภทบุคลากร (person.type_name) จากฐานข้อมูลระบบลา (mypph_db) จับคู่ด้วยเลขบัตรประชาชน
 * ถ้าเชื่อมต่อไม่ได้จะคืน available: false แทนการโยน error เพื่อไม่ให้รายงานทั้งฉบับล้ม
 */
export const fetchPersonnelTypes = async (cids: string[]): Promise<PersonnelTypeLookup> => {
  const validCids = [...new Set(cids.filter((cid) => /^\d{13}$/.test(cid)))];
  if (validCids.length === 0) return { available: true, typeByCid: new Map() };

  let connection: mysql.Connection | undefined;
  try {
    const config = getLeaveSourceConfig();
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      connectTimeout: 10_000,
      charset: "utf8mb4",
    });
    const [rows] = await connection.query({ sql: "SELECT cid, type_name FROM person WHERE cid IN (?)", timeout: 15_000 }, [validCids]);
    const typeByCid = new Map((rows as Array<{ cid: string; type_name: string | null }>)
      .filter((row) => row.type_name)
      .map((row) => [row.cid, row.type_name as string]));
    return { available: true, typeByCid };
  } catch (error) {
    console.error("Personnel type lookup failed:", error instanceof Error ? error.message : error);
    return { available: false, reason: "ดึงประเภทบุคลากรจากระบบลาไม่สำเร็จ" };
  } finally {
    await connection?.end().catch(() => undefined);
  }
};
