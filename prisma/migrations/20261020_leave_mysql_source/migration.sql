-- เพิ่มสถานะ cancelled และคอลัมน์ระบุแหล่งข้อมูล สำหรับ Sync ใบลาจาก MySQL ระบบลา
-- AlterTable
ALTER TABLE `leave_requests` ADD COLUMN `source` VARCHAR(30) NULL,
    ADD COLUMN `source_record_id` VARCHAR(64) NULL,
    MODIFY `step1_status` ENUM('pending', 'step1_approved', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    MODIFY `step2_status` ENUM('pending', 'step1_approved', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    MODIFY `status` ENUM('pending', 'step1_approved', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE UNIQUE INDEX `leave_requests_source_source_record_id_key` ON `leave_requests`(`source`, `source_record_id`);

