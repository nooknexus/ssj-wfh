# แผนพัฒนา: ผู้ใช้หนึ่งคนมีได้หลายบทบาท (Multi-Role)

สถานะ: อนุมัติแล้ว กำลังพัฒนาบน branch `feat/multi-role` (ข้อ 8: ทำไฟล์ 22, ใช้ค่าตามที่แนะนำ, hradmin เห็นคำขอ WFH ทุกกลุ่มงาน)
วันที่: 2026-10-19

## 1. ปัญหา

ตอนนี้ `users.role` เป็น enum ที่เก็บได้ค่าเดียว (`staff | leader | hradmin | itadmin | superadmin`) จึงกำหนดบทบาทซ้อนกันไม่ได้ เช่น

- ผู้ดูแล IT ที่ต้องลงเวลาแบบเจ้าหน้าที่ทั่วไปด้วย
- ผู้ดูแล HR ที่เป็นหัวหน้างานและต้องอนุมัติ WFH ของกลุ่มงานตัวเองด้วย

นอกจากนี้ โค้ดยังเช็คบทบาทด้วย `role === "..."` กระจายอยู่ 10 ไฟล์

## 2. ช่องโหว่ที่พบระหว่างสำรวจ (สำคัญ)

mutation ฝั่ง admin หลายตัวใช้แค่ `protectedProcedure` ซึ่งตรวจเพียงว่าล็อกอินแล้ว ไม่ได้ตรวจบทบาท ผลคือเจ้าหน้าที่ทั่วไปที่ล็อกอินได้ สามารถเรียก API เหล่านี้ตรงๆ ได้

| Procedure | ผลกระทบ |
|---|---|
| `user.updateRole` | เลื่อนบทบาทตัวเองเป็น `superadmin` ได้ |
| `user.updateStatus`, `user.updateDepartment` | อนุมัติบัญชีหรือย้ายกลุ่มงานของใครก็ได้ |
| `department.create/update/delete` | แก้หรือลบกลุ่มงานได้ |
| `systemSetting.update` | เปลี่ยนค่าระบบได้ทุกค่า (รับ `z.any()`) |
| `leave.syncFromGoogleSheet` | สั่ง Sync ข้อมูลลาได้ |

หน้า `/admin/*` ก็ไม่มีการตรวจบทบาทฝั่ง server เมนูแค่ถูกซ่อนใน sidebar เท่านั้น

แผนนี้จึงเพิ่ม `roleProcedure` และใช้กับ procedure เหล่านี้ไปพร้อมกันด้วย

## 3. การออกแบบ

### 3.1 ข้อมูล

- เพิ่มตาราง `user_roles (user_id, role)` และกำหนด `@@unique([user_id, role])`
- ทุกคนเป็น `staff` โดยปริยาย ตารางนี้เก็บเฉพาะบทบาทเพิ่มเติม (`leader`, `hradmin`, `itadmin`, `superadmin`) ผู้ใช้ใหม่ที่ล็อกอินครั้งแรกจึงไม่ต้องมีแถวใดๆ
- `leader` ยังผูกกับ `users.department_id` เหมือนเดิม คือเป็นหัวหน้าได้เฉพาะกลุ่มงานของตัวเอง
- คงคอลัมน์ `users.role` ไว้ 1 รอบ release เพื่อให้ย้อนกลับได้ โค้ดใหม่จะไม่อ่านคอลัมน์นี้ แล้วค่อยลบใน PR ถัดไป

```prisma
model UserRole {
  id         Int      @id @default(autoincrement())
  user_id    Int
  role       Role
  created_at DateTime @default(now())
  user       User     @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([user_id, role])
  @@map("user_roles")
}
```

> MySQL ไม่รองรับ scalar list (`Role[]`) ใน Prisma จึงใช้ตารางแยกแทน

### 3.2 Session

- `session.user.roles: AppRole[]` จะมี `"staff"` อยู่เสมอ
- `jwt` callback ดึง user จาก DB ทุก request อยู่แล้ว จึงเพิ่ม `include: { roles: true }` ได้ทันที เมื่อเปลี่ยนบทบาทแล้วจะมีผลใน request ถัดไปโดยไม่ต้องล็อกอินใหม่
- ช่วงเปลี่ยนผ่าน ถ้า token เก่ายังมีแค่ `role` ให้ `normalizeRoles()` แปลงเป็น array ให้

### 3.3 Helper (`src/lib/roles.ts`)

```ts
hasRole(roles, "leader")
hasAnyRole(roles, ["hradmin", "superadmin"])
normalizeRoles(input)                 // รับ string | string[] | undefined แล้วคืน AppRole[] ที่มี staff เสมอ
getPrimaryRole(roles)                 // บทบาทสูงสุด เรียงลำดับ superadmin > itadmin > hradmin > leader > staff
getRoleLabels(roles)                  // ["ผู้ดูแล IT", "เจ้าหน้าที่"]
getAdminNavigation(roles)             // รวมเมนูของทุกบทบาท ตัดรายการซ้ำตาม href
```

### 3.4 การตรวจสิทธิ์ฝั่ง server (`src/server/trpc.ts`)

```ts
export const roleProcedure = (allowed: AppRole[]) =>
  protectedProcedure.use(({ ctx, next }) => {
    if (!hasAnyRole(ctx.session.user.roles, allowed)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next();
  });
```

| Procedure | บทบาทที่อนุญาต |
|---|---|
| `user.getAll`, `user.updateStatus`, `user.updateDepartment` | itadmin, superadmin |
| `user.setRoles` (แทน `updateRole`) | itadmin, superadmin |
| `department.create/update/delete` | itadmin, superadmin |
| `systemSetting.update` | itadmin, superadmin |
| `leave.syncFromGoogleSheet` | hradmin, superadmin |
| `attendance.getAdminRecords` | hradmin, superadmin (ตรรกะเดิม แค่ย้ายมาใช้ helper) |

กฎของ `user.setRoles`

- มีเพียง `superadmin` ที่ให้หรือถอดบทบาท `superadmin` ได้
- ห้ามถอด `superadmin` ออกจาก superadmin คนสุดท้ายของระบบ
- ใช้ transaction โดยลบบทบาทเดิมแล้วสร้างชุดใหม่

### 3.5 UI

- **Sidebar/Header**: แสดงป้ายบทบาทสูงสุด (`getPrimaryRole`) ถ้ามีมากกว่าหนึ่งบทบาทให้ต่อท้าย "+1" และแสดงรายการเต็มใน tooltip ส่วนเมนู admin แสดงเมนูรวมของทุกบทบาท
- **หน้าจัดการผู้ใช้**: เปลี่ยนจาก Select ค่าเดียวเป็นปุ่ม "แก้ไขบทบาท" ที่เปิด Dialog พร้อม checkbox ของ 4 บทบาท ส่วน "เจ้าหน้าที่" ติ๊กไว้และปิดไว้เสมอ ในตารางแสดงบทบาทเป็น badge หลายอัน
- **หน้า WFH approvals / attendance**: เปลี่ยน `role === "leader"` เป็น `hasRole(roles, "leader")`

## 4. ไฟล์ที่จะแก้ (ทั้งหมด 21 ไฟล์ บวกอีก 1 ไฟล์ถ้าเลือกทำ)

### ฐานข้อมูล
| # | ไฟล์ | การเปลี่ยนแปลง |
|---|---|---|
| 1 | `prisma/schema.prisma` | เพิ่ม `model UserRole` และ relation `User.roles` พร้อม comment ว่า `role` เลิกใช้แล้ว |
| 2 | `prisma/migrations/20261019_multi_roles/migration.sql` (ใหม่) | `CREATE TABLE user_roles` แล้ว `INSERT ... SELECT id, role FROM users WHERE role <> 'staff'` |

### Lib / Auth
| # | ไฟล์ | การเปลี่ยนแปลง |
|---|---|---|
| 3 | `src/lib/roles.ts` | เพิ่ม helper ตามข้อ 3.3 และเปลี่ยน `getAdminNavigation` ให้รับ array |
| 4 | `src/lib/roles.test.ts` (ใหม่) | test ของทุก helper |
| 5 | `src/types/next-auth.d.ts` | เพิ่ม `roles: AppRole[]` ใน Session, User และ JWT |
| 6 | `src/lib/auth.ts` | `toSessionUser`, `jwt` (include roles) และ `session` |
| 7 | `src/app/auth/me/route.ts` | คืนค่า `roles` |

### Server
| # | ไฟล์ | การเปลี่ยนแปลง |
|---|---|---|
| 8 | `src/server/trpc.ts` | เพิ่ม `roleProcedure` และเลิกใช้ `as any` กับ user id |
| 9 | `src/server/routers/user.ts` | `getAll` include roles, เพิ่ม `setRoles` แทน `updateRole` และใส่ guard |
| 10 | `src/server/routers/wfh.ts` | แก้ 4 จุดที่เช็ค `currentUser.role` ให้ใช้ `hasAnyRole` |
| 11 | `src/server/routers/attendance.ts` | แก้จุดที่เช็คบทบาทในบรรทัด 235 |
| 12 | `src/server/routers/leave.ts` | ใส่ guard ให้ `syncFromGoogleSheet` |
| 13 | `src/server/routers/department.ts` | ใส่ guard ให้ create/update/delete |
| 14 | `src/server/routers/system-setting.ts` | ใส่ guard ให้ `update` และเปลี่ยน `z.any()` เป็น `z.object({ settings: z.record(z.string(), z.string()) })` |

### UI
| # | ไฟล์ | การเปลี่ยนแปลง |
|---|---|---|
| 15 | `src/app/(dashboard)/admin/users/page.tsx` | Dialog เลือกหลายบทบาทและ badge |
| 16 | `src/components/admin/role-editor-dialog.tsx` (ใหม่) | component ของ Dialog (แยกไฟล์เพื่อให้ฟังก์ชันไม่เกิน 40 บรรทัด) |
| 17 | `src/app/(dashboard)/wfh/approvals/page.tsx` | เปลี่ยนเงื่อนไขเป็น `hasAnyRole` |
| 18 | `src/app/(dashboard)/attendance/page.tsx` | เปลี่ยนเงื่อนไขเป็น `hasRole(..., "leader")` |
| 19 | `src/components/layout/sidebar.tsx` | เมนูรวมและป้ายบทบาท |
| 20 | `src/components/layout/header.tsx` | ป้ายบทบาทและเงื่อนไขแสดงไอคอนแจ้งเตือน |

### เอกสาร
| # | ไฟล์ | การเปลี่ยนแปลง |
|---|---|---|
| 21 | `MEMORY.md`, `CHANGELOG.md` | บันทึกโมเดลบทบาทใหม่และวิธีเช็คสิทธิ์ |

### ตัวเลือกเสริม (แนะนำให้ทำ)
| # | ไฟล์ | การเปลี่ยนแปลง |
|---|---|---|
| 22 | `src/app/(dashboard)/admin/layout.tsx` (ใหม่) | ตรวจฝั่ง server ว่ามีบทบาท admin อย่างน้อยหนึ่งบทบาท ถ้าไม่มีให้ redirect ไป `/` |

ไฟล์ที่ไม่ต้องแก้: `prisma/seed.ts` (ไม่ได้กำหนด role), ส่วน ThaiD/MOPH authorize ที่สร้าง user ใหม่จะยังได้ `role: "staff"` บนคอลัมน์เดิม และไม่ต้องเพิ่มแถวใน `user_roles`

## 5. ลำดับงานและ Commit

ทำบน branch `feat/multi-role` ที่แตกจาก `main` **หลังจาก merge PR #1 แล้ว** เพราะ `src/lib/auth.ts` แก้ซ้อนกัน

1. `feat(db): add user_roles table and migrate existing roles` (ไฟล์ 1–2)
2. `feat(auth): expose multi-role array in session` (ไฟล์ 3–7) พร้อม test
3. `fix(security): enforce role checks on admin procedures` (ไฟล์ 8–14)
4. `feat(admin): multi-role editor in user management` (ไฟล์ 15–20)
5. `feat(admin): server-side guard for admin pages` (ไฟล์ 22 ถ้าเลือกทำ)
6. `docs: document multi-role model` (ไฟล์ 21)

## 6. การ Deploy และย้อนกลับ

ลำดับบน production

1. Backup ด้วย `mysqldump`
2. รัน `migration.sql` ซึ่งสร้างตารางและคัดลอกข้อมูล โดยไม่แตะ `users.role`
3. รัน `npx prisma generate`, `npm run build` แล้ว `pm2 restart`

ถ้าต้องย้อนกลับ ให้ deploy โค้ดเวอร์ชันเดิม เพราะ `users.role` ยังอยู่ครบ ไม่ต้องย้อนฐานข้อมูล

ข้อควรรู้: บทบาทที่แก้ผ่าน UI ใหม่จะไม่ถูกเขียนกลับไปที่ `users.role` ถ้าย้อนกลับหลังจากมีการแก้บทบาทไปแล้ว ค่าเหล่านั้นจะกลับไปเป็นค่าเดิม

## 7. การทดสอบ

- Unit test (Vitest): `normalizeRoles`, `hasAnyRole`, `getPrimaryRole`, `getAdminNavigation` (รวมเมนูและตัดรายการซ้ำ) และกฎของ `setRoles` (แยก logic เป็น pure function)
- `npm run typecheck`, `npm test`, lint เฉพาะไฟล์ที่แก้
- ทดสอบในเบราว์เซอร์ (dev)
  - user ที่เป็น itadmin + leader เห็นเมนู IT และหน้าอนุมัติ WFH ของกลุ่มงานตัวเอง
  - staff เรียก `user.setRoles` ตรงๆ แล้วได้ `FORBIDDEN`
  - itadmin พยายามให้บทบาท superadmin แล้วได้ `FORBIDDEN`
  - ถอดบทบาทแล้ว เมนูหายใน request ถัดไปโดยไม่ต้อง logout

## 8. สิ่งที่ต้องการให้ตัดสินใจ

1. ให้ทำไฟล์ 22 (guard หน้า `/admin` ฝั่ง server) ไปด้วยไหม — **แนะนำให้ทำ**
2. ผู้ที่กำหนดบทบาทได้คือ itadmin + superadmin (โดย itadmin ให้บทบาท superadmin ไม่ได้) — ใช้ตามนี้ไหม
3. hradmin ควรเห็นหน้าอนุมัติ WFH ของทุกกลุ่มงานเหมือนตอนนี้ไหม (โค้ดตอนนี้ยอมให้ hradmin เข้าหน้านี้ แต่ query ถูกเปิดเฉพาะ leader จึงเห็นรายการว่าง)
