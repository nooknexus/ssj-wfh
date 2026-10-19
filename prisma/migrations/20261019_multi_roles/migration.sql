-- สร้างตาราง user_roles สำหรับผู้ใช้ที่มีหลายบทบาท
CREATE TABLE IF NOT EXISTS user_roles (
  id INT NOT NULL AUTO_INCREMENT,
  user_id INT NOT NULL,
  role ENUM('staff', 'leader', 'hradmin', 'itadmin', 'superadmin') NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE INDEX user_roles_user_id_role_key (user_id, role),
  CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- คัดลอกบทบาทเดิม (ยกเว้น staff ซึ่งเป็นค่าโดยปริยาย) โดยไม่แตะคอลัมน์ users.role
INSERT IGNORE INTO user_roles (user_id, role)
SELECT id, role FROM users WHERE role <> 'staff';
