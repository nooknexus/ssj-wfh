-- Web Conference uses named reusable links, not physical meeting rooms.
-- Abort before any destructive statement if legacy data exists.
CREATE TEMPORARY TABLE _conference_booking_guard (
  legacy_meeting_tables_must_be_empty TINYINT NOT NULL
);

INSERT INTO _conference_booking_guard (legacy_meeting_tables_must_be_empty)
SELECT IF(
  (SELECT COUNT(*) FROM meeting_rooms) = 0
  AND (SELECT COUNT(*) FROM meeting_bookings) = 0,
  1,
  NULL
);

DROP TEMPORARY TABLE _conference_booking_guard;

DROP TABLE `meeting_bookings`;
DROP TABLE `meeting_rooms`;

CREATE TABLE `conference_links` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(200) NOT NULL,
  `platform` ENUM('zoom', 'teams', 'meet', 'webex', 'other') NOT NULL,
  `url` VARCHAR(1000) NOT NULL,
  `max_participants` INTEGER NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `sort_order` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `meeting_bookings` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `link_id` INTEGER NOT NULL,
  `user_id` INTEGER NOT NULL,
  `department_id` INTEGER NULL,
  `title` VARCHAR(500) NOT NULL,
  `description` TEXT NULL,
  `start_at` DATETIME(3) NOT NULL,
  `end_at` DATETIME(3) NOT NULL,
  `attendees` INTEGER NULL,
  `status` ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
  `approved_by` INTEGER NULL,
  `approved_at` DATETIME(3) NULL,
  `reject_reason` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `meeting_bookings_link_id_start_at_idx`(`link_id`, `start_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `meeting_bookings_link_id_fkey` FOREIGN KEY (`link_id`) REFERENCES `conference_links`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `meeting_bookings_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `meeting_bookings_department_id_fkey` FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `meeting_bookings_approved_by_fkey` FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
