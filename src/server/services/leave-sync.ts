import { parse } from "csv-parse/sync";
import { db } from "../db";

const SHEET_URL = "https://docs.google.com/spreadsheets/d/13ouwAXzYdnCX7L71FXrALPrG1jKUymLKxammL00q7G0/export?format=csv&gid=0";

export async function syncLeavesFromGoogleSheet() {
  const response = await fetch(SHEET_URL);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch sheet data: ${response.statusText}`);
  }

  const csvText = await response.text();
  
  const records = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });

  let successCount = 0;
  let skippedCount = 0;

  for (const record of records as any[]) {
    try {
      const rawCid = record["เลขประจำตัวประชาชน"]?.toString().trim();
      // Remove any dashes or non-numeric characters from CID for consistent matching
      const cid = rawCid?.replace(/[^0-9]/g, ''); 
      const fullName = record["ชื่อ + นามสกุล"];
      const leaveTypeName = record["ประเภทการลา"];
      const startDateStr = record["วันที่(เริ่ม)"];
      const endDateStr = record["วันที่(สิ้นสุด)"];
      const totalDaysStr = record["จำนวนวัน"];
      const statusStr = record["สถานะวันลา"];
      const remark = record["หมายเหตุ"];

      if (!fullName || fullName === "#REF!") continue;
      if (cid === "#REF!") continue;

      // 0. Exclude WFH or other non-leave types if specified
      if (leaveTypeName?.includes("WFH") || leaveTypeName?.includes("ปฏิบัติงานที่บ้าน")) {
        console.log(`Skipping non-leave record: ${fullName} - ${leaveTypeName}`);
        skippedCount++;
        continue;
      }

      // 1. Find User by CID first, then by name (Optional)
      let user = null;
      if (cid && cid !== "") {
        user = await db.user.findFirst({
          where: {
            OR: [
              { username: cid },
              { hash_cid: cid }
            ]
          }
        });
      }

      if (!user) {
        user = await db.user.findFirst({
          where: {
            OR: [
              { name_th: { contains: fullName.trim().replace(/\s+/g, ' ') } },
              { name_th: { contains: fullName.trim().split(/\s+/)[0] } } // Fallback to first name
            ]
          }
        });
      }

      // 2. Find or Create LeaveType
      const typeName = (leaveTypeName || "อื่นๆ").trim();
      let leaveType = await db.leaveType.findFirst({
        where: { name: typeName }
      });

      if (!leaveType) {
        // Ensure code doesn't exceed 20 chars
        const safeCode = ("SYNC_" + typeName).substring(0, 20);
        leaveType = await db.leaveType.create({
          data: {
            name: typeName,
            code: safeCode,
          }
        });
      }

      // 3. Parse Dates (Always use UTC to prevent timezone shifting in MySQL DATE columns)
      const parseThaiDate = (dateStr: string) => {
        if (!dateStr) return new Date();
        const parts = dateStr.split("/");
        if (parts.length === 3) {
          const d = parseInt(parts[0]);
          const m = parseInt(parts[1]) - 1;
          let y = parseInt(parts[2]);
          
          if (y < 100) {
            // Heuristic for 2-digit years:
            // 26 -> 2026 (AD), 67 -> 2567 (BE)
            if (y > 50) y += 2500;
            else y += 2000;
          }
          
          const adYear = y > 2400 ? y - 543 : y;
          // Use Date.UTC to ensure we stay at the intended date regardless of server timezone
          return new Date(Date.UTC(adYear, m, d));
        }
        const fallback = new Date(dateStr);
        return new Date(Date.UTC(fallback.getFullYear(), fallback.getMonth(), fallback.getDate()));
      };

      const startDate = parseThaiDate(startDateStr);
      const endDate = parseThaiDate(endDateStr || startDateStr);
      
      const totalDays = parseFloat(totalDaysStr) || 1;

      if (isNaN(startDate.getTime())) {
        console.warn(`Invalid date for ${fullName}: ${startDateStr}`);
        continue;
      }

      // 4. Map status
      let leaveStatus: "pending" | "approved" | "rejected" = "pending";
      if (statusStr === "อนุมัติ") leaveStatus = "approved";
      if (statusStr === "ไม่อนุมัติ") leaveStatus = "rejected";

      // 5. Check if exists (Using Raw SQL for robust date and identity matching)
      // Since our Date objects are UTC midnight, toISOString() will give the exact YYYY-MM-DD
      const sqlStartDate = startDate.toISOString().split('T')[0];
      const sqlEndDate = endDate.toISOString().split('T')[0];

      // Check if this leave already exists for this person (by CID or UserID) on these dates
      const existingRecords = await db.$queryRawUnsafe<any[]>(`
        SELECT id, user_id, status FROM leave_requests
        WHERE (cid = ? ${user ? "OR user_id = ?" : ""})
        AND DATE(start_date) = ?
        AND DATE(end_date) = ?
        LIMIT 1
      `, cid, ...(user ? [user.id] : []), sqlStartDate, sqlEndDate);

      const existing = existingRecords[0];

      const dataToSave = {
        user_id: user?.id,
        external_name: user ? null : fullName,
        cid: cid,
        leave_type_id: leaveType.id,
        start_date: startDate,
        end_date: endDate,
        total_days: totalDays,
        reason: remark || "Synced from Google Sheet",
        status: leaveStatus,
        step1_status: leaveStatus,
        step2_status: leaveStatus,
      };

      if (!existing) {
        await db.leaveRequest.create({
          data: dataToSave
        });
        successCount++;
      } else {
        // Update existing record if status or any info changed (Overwrite logic)
        await db.leaveRequest.update({
          where: { id: existing.id },
          data: {
            ...dataToSave,
            // Keep existing link if present
            user_id: existing.user_id || user?.id,
          }
        });
        successCount++;
      }
    } catch (err) {
      console.error("Error processing record:", err);
    }
  }

  // 6. Relink unlinked leaves (Cleanup)
  await relinkUnlinkedLeaves();

  return { successCount, skippedCount };
}

/**
 * Scan all leave requests that don't have a user_id 
 * and try to link them if a user with matching CID now exists.
 */
async function relinkUnlinkedLeaves() {
  const unlinked = await db.leaveRequest.findMany({
    where: {
      user_id: null,
      cid: { not: null }
    }
  });

  console.log(`Checking ${unlinked.length} unlinked records for potential matching users...`);

  let linkedCount = 0;
  for (const leave of unlinked) {
    if (!leave.cid) continue;

    const user = await db.user.findFirst({
      where: {
        OR: [
          { username: leave.cid },
          { hash_cid: leave.cid }
        ]
      }
    });

    if (user) {
      await db.leaveRequest.update({
        where: { id: leave.id },
        data: {
          user_id: user.id,
          // We can keep external_name and external_cid as metadata
        }
      });
      linkedCount++;
    }
  }

  if (linkedCount > 0) {
    console.log(`Successfully linked ${linkedCount} previously unlinked records to users.`);
  }
}
