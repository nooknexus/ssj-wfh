# แผนปฏิบัติการระบบจอง Web Conference

> **สำหรับเอเจนต์:** ต้องใช้ `superpowers:subagent-driven-development` (แนะนำ) หรือ `superpowers:executing-plans` เพื่อทำตามงานทีละรายการ รายการงานใช้ checkbox (`- [ ]`) สำหรับติดตามความคืบหน้า

**เป้าหมาย:** ส่งมอบระบบจองและดูแลลิงก์ Web Conference ที่ปลอดภัย

**สถาปัตยกรรม:** Prisma แทนโมเดลห้องประชุมจริงด้วยลิงก์และช่วงเวลาแบบ datetime เต็มรูปแบบ โมดูลโดเมนขนาดเล็กและ pure function รับผิดชอบ validation เวลาชนกัน ความพร้อม และการสร้างช่วงเวลา ส่วน tRPC router เรียกใช้กฎเหล่านี้ภายใน transaction ที่มีการตรวจสิทธิ์ ส่วนประกอบ client ขนาดเล็กนำมาประกอบเป็นหน้าจอง ตารางรายวัน รายการของฉัน และหน้าผู้ดูแล

**เทคโนโลยี:** Next.js 16 App Router, React 19, TypeScript, tRPC 11, Prisma/MySQL, Zod, Vitest, date-fns และ shadcn/Base UI ที่มีอยู่

**สเปก:** `docs/superpowers/specs/2026-10-20-web-conference-booking.md`

## ข้อกำหนดร่วม

- `TDD_REQUIRED: yes`; จุดสังเกตพฤติกรรมคือกฎโดเมนที่ export และผลลัพธ์ที่เรียกผ่าน tRPC ได้ ต้องบันทึกหลักฐาน RED, GREEN และ REFACTOR ของทุกการเปลี่ยนพฤติกรรม
- อ่าน `test-driven-development/writing-good-tests.md` ก่อนแก้ไข test ทุกครั้ง แต่ละ test ต้องระบุการเปลี่ยน production ที่มันตรวจจับได้ และคาดหวังผลด้วยค่าที่อนุมานเอง
- เก็บการเปลี่ยนแปลงของผู้ใช้นอก branch นี้ไว้ ใช้เฉพาะ worktree แยกบน `feat/web-conference-booking`
- ทุก procedure สำหรับผู้ดูแล Web Conference ต้องใช้ `roleProcedure(CONFERENCE_ADMIN_ROLES)` ห้ามใช้การซ่อนเมนูเป็นกลไกสิทธิ์
- URL ปรากฏได้เฉพาะในการจองที่อนุมัติแล้วและเป็นของผู้เรียก ตารางรายวันและรายการที่ยังไม่อนุมัติห้ามเปิดเผย URL
- migration ต้องล้มเหลวก่อนแก้โครงสร้างตารางหากตารางเดิมมีข้อมูล
- ฟังก์ชันใน `src/components/meeting/*` ที่สร้างใหม่ต้องไม่เกิน 40 บรรทัด ให้ประกอบจาก component ขนาดเล็กแทนการเพิ่ม page component ขนาดใหญ่
- ห้ามเขียน production code ก่อนเห็น test ที่ล้มเหลว

## จุดเน้นการทบทวน

- การจองติดกัน เช่น 10:00–11:00 กับ 11:00–12:00 ต้องจองได้ แต่ช่วงที่ทับจริงต้องถูกปฏิเสธ
- รายการ `pending` กันการจองซ้อนเช่นเดียวกับ `approved` ส่วน `rejected` และ `cancelled` ต้องไม่กัน
- การอนุมัติพร้อมกันต้องไม่ทำให้การจองสองรายการที่ทับกันบนลิงก์เดียวกันกลายเป็น `approved` ทั้งคู่
- ผู้ใช้ทั่วไปต้องเรียก procedure ของผู้ดูแลโดยตรงไม่ได้ แม้เมนูจะถูกซ่อน
- URL ต้องไม่รั่วผ่านตารางรายวัน การจอง `pending`/`rejected`/`cancelled` หรือข้อมูลลิงก์ที่ปิดใช้งาน

### Task 1: เปลี่ยนโมเดลฐานข้อมูลอย่างปลอดภัย

**ไฟล์:**
- แก้ไข: `prisma/schema.prisma`
- สร้าง: `prisma/migrations/20261020_conference_booking/migration.sql`

**ส่วนเชื่อมต่อ:**
- ส่งมอบ Prisma `ConferenceLink`, `ConferencePlatform` และ `MeetingBooking` ที่มี `link_id`, `start_at`, `end_at` ให้แก่งานที่ 3–7

- [x] **ขั้นที่ 1:** เพิ่ม fixture หรือ executable check ของ migration ที่พิสูจน์ว่า guard ปฏิเสธตารางเดิมที่มีข้อมูล
- [x] **ขั้นที่ 2:** รัน check กับ schema พัฒนาที่ว่าง และยืนยันว่าล้มเหลวก่อนมี migration
- [x] **ขั้นที่ 3:** แก้ Prisma schema และเขียน SQL migration ที่มี empty-table guard, การแทนตาราง, index, foreign key และ generate client
- [x] **ขั้นที่ 4:** รัน migration safety check และ Prisma validation ซ้ำ ผลที่คาดหวัง: ผ่าน
- [x] **ขั้นที่ 5:** Commit `feat(db): model conference links and datetime bookings`

### Task 2: เขียนและทดสอบกฎโดเมนการจอง

**ไฟล์:**
- สร้าง: `src/lib/conference-booking.ts`
- สร้าง: `src/lib/conference-booking.test.ts`

**ส่วนเชื่อมต่อ:**
- ส่งมอบ `intervalsOverlap`, `blocksAvailability`, `getLinkAvailability`, `validateBookingRequest`, `getHalfHourSlots` และ type สำหรับช่วงเวลา/ข้อมูลนำเข้าที่งานที่ 3–4 ใช้

- [x] **ขั้นที่ 1:** เขียน Vitest ที่ล้มเหลวสำหรับเวลาทับบางส่วน/ครอบทั้งช่วง/ติดกัน สถานะที่กันเวลา วันเวลาหรือระยะเวลาที่ไม่ถูกต้อง ความจุ และช่วงเวลา 07:00–20:00 ทุก 30 นาที
- [x] **ขั้นที่ 2:** รัน `npm test -- src/lib/conference-booking.test.ts`; **ผลที่คาดหวัง:** ล้มเหลวเพราะยังไม่มีโมดูล
- [x] **ขั้นที่ 3:** เขียนเฉพาะ domain function ที่ test ต้องใช้
- [x] **ขั้นที่ 4:** รัน focused test ซ้ำ ผลที่คาดหวัง: ผ่านทั้งหมด แล้ว refactor เฉพาะชื่อ/type ขณะยังเขียว
- [x] **ขั้นที่ 5:** Commit `feat(meeting): add conference booking rules`

### Task 3: สร้าง tRPC API ที่มีการตรวจสิทธิ์

**ไฟล์:**
- แก้ไข: `src/lib/roles.ts`
- แก้ไข: `src/server/routers/meeting.ts`
- แก้ไข: `src/server/routers/dashboard.ts`
- สร้าง: `src/server/routers/meeting.test.ts`

**ส่วนเชื่อมต่อ:**
- ใช้โมเดล Prisma จากงานที่ 1 และ domain function จากงานที่ 2
- ส่งมอบ `getAvailableLinks`, `getDaySchedule`, `createBooking`, `getMyBookings`, `cancelBooking`, `getAllBookings`, `updateBookingStatus`, `listLinks`, `createLink`, `updateLink`

- [ ] **ขั้นที่ 1:** เขียน caller-level test ที่ล้มเหลวสำหรับการปฏิเสธผู้ใช้ที่ไม่ใช่แอดมิน การยกเลิกโดยเจ้าของเท่านั้น การเปิดเผย URL เฉพาะอนุมัติ การปฏิเสธเวลาชนกับ pending และการปฏิเสธเวลาชนขณะอนุมัติ
- [ ] **ขั้นที่ 2:** รัน `npm test -- src/server/routers/meeting.test.ts`; **ผลที่คาดหวัง:** ล้มเหลวเพราะ API ห้องประชุมเดิมไม่มีพฤติกรรมนี้
- [ ] **ขั้นที่ 3:** เพิ่ม `CONFERENCE_ADMIN_ROLES` แล้วแทน router ด้วย procedure ที่ validate ด้วย Zod ใช้ interactive transaction สำหรับตรวจเวลาชนตอนสร้างและอนุมัติ และคืน DTO ที่ปิดบัง URL ตามสิทธิ์
- [ ] **ขั้นที่ 4:** รัน router/domain test แบบ focused ซ้ำ ผลที่คาดหวัง: ผ่านทั้งหมด
- [ ] **ขั้นที่ 5:** Commit `feat(api): secure web conference booking procedures`

### Task 4: สร้างหน้าจองสำหรับผู้ใช้

**ไฟล์:**
- สร้าง: `src/components/meeting/time-select.tsx`
- สร้าง: `src/components/meeting/conference-link-card.tsx`
- สร้าง: `src/components/meeting/day-schedule.tsx`
- แก้ไข: `src/app/(dashboard)/meeting/page.tsx`
- ลบ: `src/app/(dashboard)/meeting/book/page.tsx`

**ส่วนเชื่อมต่อ:**
- ใช้ procedure สำหรับผู้ใช้จากงานที่ 3 และค่าเวลา slot จากงานที่ 2
- ส่งมอบ flow การจองรวมที่ `/meeting` และตารางรายวัน

- [ ] **ขั้นที่ 1:** ขยาย domain test ของงานที่ 2 ด้วยกรณีที่ล้มเหลวสำหรับการจัดสถานะลิงก์ปิดใช้งาน ไม่ว่าง และเกินความจุ
- [ ] **ขั้นที่ 2:** รัน test นั้นและยืนยันว่าล้มเหลว
- [ ] **ขั้นที่ 3:** เขียน component ขนาดเล็ก แล้วแทนหน้า mock room ด้วยการเลือกช่วงเวลา โหลดความพร้อม ส่งคำขอพร้อม feedback และตารางที่ไม่มี URL
- [ ] **ขั้นที่ 4:** รัน domain test และ typecheck ผลที่คาดหวัง: ผ่าน
- [ ] **ขั้นที่ 5:** Commit `feat(meeting): add web conference booking screen`

### Task 5: สร้างหน้าจัดการการจองของฉัน

**ไฟล์:**
- แก้ไข: `src/app/(dashboard)/meeting/my-bookings/page.tsx`

**ส่วนเชื่อมต่อ:**
- ใช้ response จาก `getMyBookings` และ `cancelBooking` ของงานที่ 3

- [ ] **ขั้นที่ 1:** เพิ่ม API DTO test ที่ล้มเหลวเพื่อพิสูจน์ว่าเก็บเหตุผลไม่อนุมัติไว้ แต่รายการที่ยังไม่อนุมัติไม่มี URL
- [ ] **ขั้นที่ 2:** รัน `npm test -- src/server/routers/meeting.test.ts`; **ผลที่คาดหวัง:** ล้มเหลวเพราะยังไม่มี disclosure contract
- [ ] **ขั้นที่ 3:** แสดงลิงก์/แพลตฟอร์ม วันเวลา สถานะ/เหตุผล ปุ่มยกเลิก และปุ่มเปิด/คัดลอกเฉพาะเมื่ออนุมัติแล้ว พร้อม invalidate รายการหลังยกเลิก
- [ ] **ขั้นที่ 4:** รัน API test และ typecheck ซ้ำ ผลที่คาดหวัง: ผ่าน
- [ ] **ขั้นที่ 5:** Commit `feat(meeting): manage personal conference bookings`

### Task 6: สร้างหน้าผู้ดูแล Web Conference

**ไฟล์:**
- สร้าง: `src/components/meeting/conference-link-form.tsx`
- สร้าง: `src/app/(dashboard)/admin/meeting/layout.tsx`
- แก้ไข: `src/app/(dashboard)/admin/meeting/page.tsx`
- แก้ไข: `src/lib/roles.ts`

**ส่วนเชื่อมต่อ:**
- ใช้ procedure ผู้ดูแลจากงานที่ 3 และ `CONFERENCE_ADMIN_ROLES`
- ส่งมอบแท็บอนุมัติ/ดูทั้งหมด แท็บจัดการลิงก์ layout ที่ guard ตามบทบาท และเมนูผู้ดูแล

- [ ] **ขั้นที่ 1:** เขียน role/navigation test ที่ล้มเหลวสำหรับสิทธิ์ itadmin และการไม่แสดงแก่ผู้ที่ไม่ใช่แอดมิน
- [ ] **ขั้นที่ 2:** รัน `npm test -- src/lib/roles.test.ts`; **ผลที่คาดหวัง:** ล้มเหลวเพราะไม่มีพฤติกรรมเมนู/บทบาท Web Conference
- [ ] **ขั้นที่ 3:** เพิ่ม layout guard สำหรับ IT/superadmin แท็บจัดการ การปฏิเสธพร้อมเหตุผล ฟอร์มเพิ่ม/แก้/ปิดลิงก์ และเมนูใหม่
- [ ] **ขั้นที่ 4:** รัน focused test และ typecheck ซ้ำ ผลที่คาดหวัง: ผ่าน
- [ ] **ขั้นที่ 5:** Commit `feat(admin): manage web conference links and approvals`

### Task 7: จัดทำเอกสารและตรวจสอบระบบที่ส่งมอบ

**ไฟล์:**
- แก้ไข: `USER_MANUAL.md`
- แก้ไข: `CHANGELOG.md`
- แก้ไข: `MEMORY.md`

**ส่วนเชื่อมต่อ:**
- ใช้ผลจากงานที่ 1–6

- [ ] **ขั้นที่ 1:** สำรองฐานข้อมูลพัฒนา รัน migration และตรวจ schema ด้วย Prisma
- [ ] **ขั้นที่ 2:** ทดสอบใน browser ตามกรณี: ความพร้อม/เวลาชน ความจุ URL หลังอนุมัติ การใช้ช่วงเวลาหลังไม่อนุมัติ และเรียก mutation โดยผู้ไม่มีสิทธิ์
- [ ] **ขั้นที่ 3:** อัปเดตคู่มือผู้ใช้ changelog และ project memory ด้วย route และกฎสุดท้าย
- [ ] **ขั้นที่ 4:** รัน `npm run typecheck && npm test && npm run build`; **ผลที่คาดหวัง:** ทุกคำสั่ง exit 0
- [ ] **ขั้นที่ 5:** Commit `docs: document web conference booking`

## การทบทวนแผนด้วยตนเอง

- ความครอบคลุม: งานที่ 1–7 ครบตามข้อกำหนดด้านข้อมูล สิทธิ์ UI เอกสาร และการตรวจสอบ
- ความสอดคล้องของส่วนเชื่อมต่อ: schema ส่งต่อให้กฎโดเมนและ API โดย UI เข้าถึงข้อมูลผ่าน API เท่านั้น
- จุดเน้นการทบทวนถูกผูกกับงานที่ 2 (ช่วงเวลา/สถานะ/ความจุ), งานที่ 3 (concurrency/สิทธิ์/การเปิดเผย) และงานที่ 4–6 (การเปิดเผยข้อมูลและสิทธิ์บน UI)
- คำวินิจฉัย: ใช้ migration guard ที่ตรวจสอบได้แทนการลบข้อมูลเดิมแบบเงียบ ๆ หากมีข้อมูลเดิม migration ต้องหยุดและต้องตัดสินใจเรื่องย้ายข้อมูลอย่างชัดเจน
- คำวินิจฉัย: branch นี้เริ่มจาก repository default branch ซึ่งไม่มี `admin/meeting/layout.tsx` จึงสร้างไฟล์แทนการแก้ไขไฟล์ที่มีเฉพาะบน branch งานลาที่ไม่เกี่ยวข้อง ความเสี่ยงหากตัดสินใจผิด: การรวม branch ภายหลังอาจต้องแก้ conflict เล็กน้อย
