-- ข้อยกเว้นการลงเวลา (แจ้งลา / ไปราชการ) จากหน้าแผนงานรายสัปดาห์
-- CreateTable
CREATE TABLE IF NOT EXISTS `attendance_exceptions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `user_id` INTEGER NOT NULL,
    `date` DATE NOT NULL,
    `type` ENUM('leave', 'official_trip') NOT NULL,
    `period` ENUM('full', 'morning', 'afternoon') NOT NULL DEFAULT 'full',
    `reason` TEXT NULL,
    `location` VARCHAR(255) NULL,
    `attachment_url` VARCHAR(500) NULL,
    `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    `approved_by` INTEGER NULL,
    `approved_at` DATETIME(3) NULL,
    `reject_reason` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `attendance_exceptions_user_id_date_idx`(`user_id`, `date`),
    INDEX `attendance_exceptions_date_status_idx`(`date`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `attendance_exceptions` ADD CONSTRAINT `attendance_exceptions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attendance_exceptions` ADD CONSTRAINT `attendance_exceptions_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

