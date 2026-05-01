UPDATE users
SET role = CASE
  WHEN role = 'admin' THEN 'superadmin'
  WHEN role IN ('manager', 'director') THEN 'leader'
  WHEN role = 'pending' THEN 'staff'
  ELSE role
END;

ALTER TABLE users
MODIFY COLUMN role ENUM('staff', 'leader', 'hradmin', 'itadmin', 'superadmin') NOT NULL DEFAULT 'staff';
