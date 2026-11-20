-- หมายเหตุ/เหตุผลที่ผู้ใช้กรอกเองในประวัติการลงเวลา (เช่น เหตุผลที่มาสาย)
-- AlterTable
ALTER TABLE `attendance_records` ADD COLUMN `remark` TEXT NULL;
