# แผนพัฒนา: ระบบจอง Web Conference (`/meeting`)

สถานะ: พัฒนาแล้วบน branch `feat/web-conference` (ต่อยอดจากงานที่ commit ไว้ใน `feat/web-conference-booking`)
วันที่: 2026-10-20

## 1. ปัญหาของโมดูลปัจจุบัน

โมดูล `/meeting` ตอนนี้ออกแบบไว้สำหรับ **ห้องประชุมจริง** และยังทำไม่เสร็จ

| ปัญหา | รายละเอียด |
|---|---|
| ข้อมูลไม่ตรงกับงาน | ตาราง `meeting_rooms` มี capacity, location, image ของห้อง แต่สิ่งที่ต้องการคือ **ลิงก์ Web Conference** |
| ไม่ตรวจเวลาชน | `createBooking` ไม่ได้ตรวจว่าช่วงเวลานั้นถูกจองแล้วหรือไม่ จึงจองซ้อนกันได้ |
| ช่องโหว่สิทธิ์ | `updateBookingStatus` และ `getPendingBookings` ใช้แค่ `protectedProcedure` ใครที่ล็อกอินแล้วก็อนุมัติการจองได้ |
| เก็บเวลาเสี่ยงคลาด | `start_time`/`end_time` เป็น `@db.Time` แต่โค้ดสร้าง `Date` ที่มีวันที่ติดมา ทำให้เวลาเพี้ยนตาม timezone ได้ |
| ไม่มีหน้าจัดการ | ไม่มีหน้าเพิ่ม/แก้ห้อง หรือลิงก์ ส่วนหน้า `/admin/meeting` ก็ไม่มีในเมนู |
| ยกเลิกไม่ได้ | ผู้ใช้ยกเลิกการจองของตัวเองไม่ได้ |

ใน DB dev ตาราง `meeting_rooms` และ `meeting_bookings` ยังว่างทั้งคู่ จึงปรับโครงสร้างได้โดยไม่ต้องย้ายข้อมูล

## 2. สิ่งที่ตกลงกันแล้ว

- ผู้ใช้เลือก **วัน + เวลาเริ่ม–สิ้นสุด** แล้วระบบแสดงเฉพาะ **ลิงก์ที่ว่าง** ในช่วงนั้นให้เลือก พร้อมแสดงตารางการจองของวันนั้น
- จองแล้วสถานะเป็น **รออนุมัติ** จากนั้น **ผู้ดูแล IT / ผู้ดูแลระบบสูงสุด** อนุมัติหรือไม่อนุมัติ ผู้ใช้เข้ามาดูสถานะเองที่หน้า "การจองของฉัน"
- ผู้ดูแล IT / ผู้ดูแลระบบสูงสุด เพิ่ม แก้ และปิดใช้งานลิงก์ได้ และดูการจองทั้งหมดได้
- ข้อมูลของแต่ละลิงก์: ชื่อ, **แพลตฟอร์ม** (Zoom / Microsoft Teams / Google Meet / Webex / อื่น ๆ), URL, **จำนวนผู้เข้าร่วมสูงสุด**, รายละเอียด, เปิด/ปิดใช้งาน

## 3. การออกแบบ

### 3.1 ข้อมูล

แทนตาราง `meeting_rooms` ด้วย `conference_links` และปรับ `meeting_bookings`

```prisma
enum ConferencePlatform { zoom  teams  meet  webex  other }

model ConferenceLink {
  id               Int                @id @default(autoincrement())
  name             String             @db.VarChar(200)   // เช่น "Zoom สสจ. บัญชี 1"
  platform         ConferencePlatform
  url              String             @db.VarChar(1000)
  max_participants Int?
  description      String?            @db.Text
  is_active        Boolean            @default(true)
  sort_order       Int                @default(0)
  created_at       DateTime           @default(now())
  updated_at       DateTime           @updatedAt
  bookings         MeetingBooking[]
  @@map("conference_links")
}

model MeetingBooking {
  id            Int            @id @default(autoincrement())
  link_id       Int
  link          ConferenceLink @relation(...)
  user_id       Int
  department_id Int?
  title         String         @db.VarChar(500)
  description   String?        @db.Text
  start_at      DateTime       // วันและเวลาเริ่ม (แทน date + start_time)
  end_at        DateTime       // วันและเวลาสิ้นสุด
  attendees     Int?
  status        BookingStatus  @default(pending)   // pending | approved | rejected | cancelled
  approved_by   Int?
  approved_at   DateTime?
  reject_reason String?        @db.Text
  ...
  @@index([link_id, start_at])
  @@map("meeting_bookings")
}
```

- ใช้ `start_at`/`end_at` เป็น DateTime เต็ม แทน `date` + `@db.Time` เพื่อเลี่ยงปัญหา timezone และทำให้ตรวจเวลาชนได้ด้วย query เดียว
- migration จะตรวจก่อนว่า `meeting_rooms`/`meeting_bookings` ว่างอยู่ ถ้ามีข้อมูลจะหยุด ไม่ลบทิ้ง

### 3.2 กฎการจอง (pure function + unit test): `src/lib/conference-booking.ts`

- **เวลาชนกัน**: `a.start < b.end && b.start < a.end` (เริ่มพอดีตอนอีกรายการจบ ไม่ถือว่าชน)
- การจองที่ **รออนุมัติ** และ **อนุมัติแล้ว** กันช่วงเวลา ส่วน **ไม่อนุมัติ** และ **ยกเลิก** ปล่อยช่วงเวลาให้คนอื่นจองได้
- ตรวจความถูกต้อง: เวลาสิ้นสุดต้องหลังเวลาเริ่ม, ยาวไม่เกิน 8 ชั่วโมง, จองย้อนหลังไม่ได้, จำนวนผู้เข้าร่วมต้องไม่เกิน `max_participants` ของลิงก์
- ช่วงเวลาให้เลือกทุก 30 นาที ตั้งแต่ 07:00–20:00

### 3.3 API: `src/server/routers/meeting.ts` (เขียนใหม่)

| Procedure | สิทธิ์ | หน้าที่ |
|---|---|---|
| `getAvailableLinks({ startAt, endAt, attendees })` | ทุกคน | ลิงก์ที่เปิดใช้งาน พร้อมสถานะ ว่าง / ไม่ว่าง / จำนวนผู้เข้าร่วมเกิน |
| `getDaySchedule({ date })` | ทุกคน | ตารางการจองของวันนั้นแยกตามลิงก์ (แสดงหัวข้อและเวลา แต่ไม่แสดง URL) |
| `createBooking(...)` | ทุกคน | ตรวจกฎและเวลาชนใน transaction แล้วสร้างการจองสถานะ `pending` |
| `getMyBookings()` | ทุกคน | การจองของตัวเอง แสดง **URL เฉพาะรายการที่อนุมัติแล้ว** |
| `cancelBooking({ id })` | เจ้าของ | ยกเลิกได้เมื่อยังไม่ถึงเวลาเริ่ม |
| `getAllBookings({ status?, from?, to? })` | itadmin, superadmin | รายการทั้งหมดสำหรับหน้าอนุมัติ |
| `updateBookingStatus({ id, status, rejectReason? })` | itadmin, superadmin | อนุมัติหรือไม่อนุมัติ โดยตรวจเวลาชนซ้ำอีกครั้งก่อนอนุมัติ |
| `listLinks / createLink / updateLink` | itadmin, superadmin | จัดการลิงก์ (ปิดใช้งานแทนการลบ เพื่อเก็บประวัติการจอง) |

### 3.4 หน้าเว็บ

| หน้า | การเปลี่ยนแปลง |
|---|---|
| `/meeting` | หน้าจอง: เลือกวัน, เวลาเริ่ม, เวลาสิ้นสุด และจำนวนผู้เข้าร่วม แล้วแสดงการ์ดลิงก์ (ไอคอนแพลตฟอร์ม, ความจุ, ว่างหรือไม่ว่าง) ให้กดเลือก จากนั้นกรอกหัวข้อการประชุมแล้วส่ง ใต้ฟอร์มแสดงตารางการจองของวันนั้น |
| `/meeting/my-bookings` | การจองของฉัน: สถานะ (รออนุมัติ / อนุมัติแล้ว / ไม่อนุมัติพร้อมเหตุผล / ยกเลิก) ปุ่ม "เปิดลิงก์" และ "คัดลอกลิงก์" เมื่ออนุมัติแล้ว และปุ่มยกเลิก |
| `/meeting/book` | ลบทิ้ง (รวมเข้ากับ `/meeting`) |
| `/admin/meeting` | สำหรับผู้ดูแล 2 แท็บ: **"รออนุมัติ / ทั้งหมด"** (อนุมัติหรือไม่อนุมัติพร้อมเหตุผล) และ **"จัดการลิงก์"** (เพิ่ม/แก้/ปิดใช้งาน) |
| เมนู Administrator | เพิ่ม "จัดการ Web Conference" สำหรับ itadmin/superadmin พร้อมตัวเลขจำนวนรายการที่รออนุมัติ |
| `admin/meeting/layout.tsx` | เปลี่ยน guard เป็น itadmin/superadmin |

## 4. ไฟล์ที่จะแก้

| ไฟล์ | การเปลี่ยนแปลง |
|---|---|
| `prisma/schema.prisma` | `ConferenceLink`, `ConferencePlatform`, ปรับ `MeetingBooking` และลบ `MeetingRoom`/`RoomStatus` |
| `prisma/migrations/2026xxxx_conference_booking/migration.sql` (ใหม่) | ตรวจว่าตารางว่าง แล้วสร้างและปรับตาราง |
| `src/lib/conference-booking.ts` + `.test.ts` (ใหม่) | กฎข้อ 3.2 |
| `src/lib/roles.ts` | `CONFERENCE_ADMIN_ROLES` และเมนูใหม่ของ itadmin |
| `src/server/routers/meeting.ts` | เขียนใหม่ตามข้อ 3.3 |
| `src/app/(dashboard)/meeting/page.tsx` | หน้าจองใหม่ |
| `src/app/(dashboard)/meeting/my-bookings/page.tsx` | ปรับตามข้อ 3.4 |
| `src/app/(dashboard)/meeting/book/page.tsx` | ลบ |
| `src/app/(dashboard)/admin/meeting/page.tsx` + `layout.tsx` | หน้าผู้ดูแล 2 แท็บ และ guard |
| `src/components/meeting/*` (ใหม่) | ตัวเลือกเวลา, การ์ดลิงก์, ตารางรายวัน, ฟอร์มลิงก์ (แยกไฟล์ให้ฟังก์ชันไม่เกิน 40 บรรทัด) |
| `src/server/routers/dashboard.ts` | ตรวจและปรับถ้ามีการอ้างอิง `meetingRoom`/`meetingBooking` เดิม |
| `USER_MANUAL.md`, `CHANGELOG.md`, `MEMORY.md` | เอกสาร |

ทำบน branch `feat/web-conference-booking` แบ่ง commit เป็น: ข้อมูล → กฎและ test → API → หน้าผู้ใช้ → หน้าผู้ดูแล → เอกสาร

## 5. การทดสอบ

1. Unit test: เวลาชน (ทับบางส่วน / ครอบทั้งช่วง / ต่อเนื่องพอดี), สถานะที่กันช่วงเวลา, การตรวจความถูกต้อง และจำนวนผู้เข้าร่วมเกิน
2. `npm run typecheck`, `npm test`, `npm run build`
3. Backup DB dev แล้วรัน migration
4. ทดสอบในเบราว์เซอร์
   - superadmin เพิ่มลิงก์ 2 รายการ (Zoom 100 คน, Teams 300 คน)
   - จอง Zoom 10:00–11:00 ได้ แล้วจองช่วง 10:30–11:30 ต้องเห็น Zoom เป็น "ไม่ว่าง" แต่ Teams ยัง "ว่าง"
   - จองโดยใส่ผู้เข้าร่วม 150 คน ต้องเห็น Zoom เป็น "เกินความจุ"
   - ก่อนอนุมัติ หน้า "การจองของฉัน" ไม่แสดง URL พออนุมัติแล้วแสดง URL
   - ไม่อนุมัติพร้อมเหตุผล ผู้ใช้ต้องเห็นเหตุผล และช่วงเวลานั้นกลับมาว่างให้จองได้
   - เรียก `updateBookingStatus` โดยตรงด้วยบัญชีที่ไม่ใช่ผู้ดูแล ต้องได้ `FORBIDDEN`
5. ลบข้อมูลทดสอบหลังเสร็จ

## 6. นอกขอบเขต (ทำต่อได้ภายหลัง)

- แจ้งผลการอนุมัติผ่าน LINE (MOPH Alert) ซึ่งระบบมี API ไว้แล้ว
- การจองแบบซ้ำทุกสัปดาห์
- เชื่อม Zoom/Teams API เพื่อสร้างห้องประชุมให้อัตโนมัติ

## 7. สถานะงานจริง ณ วันที่ 20 ตุลาคม 2026

**สถานะ: หยุดดำเนินการตามคำขอของผู้ใช้ — ฟีเจอร์นี้ยังไม่เสร็จและยังไม่พร้อมใช้งาน**

งานที่ทำและ commit ไว้บน branch `feat/web-conference-booking`:

- ปรับ Prisma schema และเพิ่ม migration ที่หยุดทำงานหากตารางเดิมมีข้อมูล
- เพิ่มกฎเวลาชนกัน ความจุ สถานะที่กันช่วงเวลา และช่วงเวลา 30 นาที พร้อม unit test
- เขียน tRPC API ใหม่สำหรับจอง ดูตาราง ยกเลิก จัดการลิงก์ และอนุมัติ โดยมีการตรวจสิทธิ์และปิดบัง URL จนกว่าจะอนุมัติ

งานที่เริ่มแล้วแต่ยังไม่ผ่านการตรวจสอบหรือ commit:

- เริ่มเปลี่ยนหน้า `/meeting` และสร้าง component เลือกเวลา การ์ดลิงก์ และตารางรายวัน แต่ยังไม่ได้ทดสอบในเบราว์เซอร์, typecheck, test หรือ commit

งานค้างก่อนนำไปใช้งาน:

1. ทำหน้า `/meeting` ให้ครบและทดสอบ flow เลือกวัน เวลา จำนวนผู้เข้าร่วม และลิงก์ที่ไม่พร้อมใช้งาน
2. ทำหน้า `/meeting/my-bookings` ให้แสดงสถานะ เหตุผล ปุ่มยกเลิก และเปิด/คัดลอก URL เฉพาะเมื่ออนุมัติ
3. ทำหน้า `/admin/meeting`, role guard, ฟอร์มจัดการลิงก์ และเมนูผู้ดูแล
4. แก้ typecheck ที่หน้า admin เดิมยังเรียก `getPendingBookings` และตรวจสอบปัญหา import `logo.png` ที่พบอยู่เดิม
5. สำรองฐานข้อมูลพัฒนา รัน migration, ทดสอบในเบราว์เซอร์ตามกรณีในข้อ 5, อัปเดตเอกสาร และรัน `npm run typecheck && npm test && npm run build`
6. ทำ code review แล้วจึงนำ branch เข้า checkout หลักหรือ merge เมื่อเจ้าของงานอนุมัติ
