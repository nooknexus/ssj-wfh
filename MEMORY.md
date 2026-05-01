# Project Memory (plk-wfh-system)

## 📌 ข้อมูลทั่วไปของโปรเจค
- **ชื่อโปรเจค:** PLK WFH System
- **เป้าหมาย:** ระบบจัดการการปฏิบัติงานที่บ้าน (WFH), ระบบลงเวลาปฏิบัติราชการ (Attendance), ลางาน (Leave), จองห้องประชุม (Meeting Room), และจัดการเอกสาร (Document Tracking)
- **Node Version:** 20+

## 🛠 Tech Stack
- **Framework:** Next.js 16.2 (App Router)
- **UI & Styling:** React 19, Tailwind CSS v4, shadcn/ui, Lucide Icons, Recharts (สำหรับ Dashboard)
- **State & Data Fetching:** tRPC (v11), TanStack React Query
- **Database ORM:** Prisma (v6.19)
- **Database:** MySQL
- **Authentication:** NextAuth.js
- **Map Integration:** react-leaflet, leaflet (สำหรับการลงเวลาผ่านพิกัด GPS)
- **Utility:** date-fns (จัดการวันที่), Zod (Validation), react-hook-form

## 💡 โครงสร้างระบบหลัก (Core Features)
1. **Attendance System (ระบบลงเวลา)**
   - บันทึกพิกัด (Lat/Lng) ตอนเข้า-ออกงาน
   - ประเภทการทำงาน: สำนักงาน (Office), ทำงานที่บ้าน (WFH), ไปราชการ (Official Trip), ลงพื้นที่ (Onsite)
   - ผูกกับระบบแผนงานรายสัปดาห์ (Weekly Plan) เพื่อ Suggestion ข้อมูลเวลาลงเวลาออกงาน
2. **Leave Management (ระบบการลา)**
   - ดึงโควต้าการลาจาก Google Sheets (`sync-sheet`)
   - นำโควต้ามาคำนวณและแสดงผลในระบบ
3. **Meeting Booking (ระบบจองห้องประชุม)**
   - จัดการข้อมูลห้องประชุมและอนุมัติการจอง
4. **Document Tracking (ระบบติดตามเอกสาร)**
   - ติดตามสถานะเอกสาร รับ/ส่ง/สั่งการ

## ⚠️ ข้อควรระวังและ Technical Debt ที่ได้แก้ไข
1. **ปัญหา Timezone และ วันที่ (Date Normalization)**
   - **ปัญหา:** การ Query ข้อมูลใน Database ด้วย `startOfDay(new Date())` มักมีปัญหา Timezone ทำให้ขอบเขตวันคลาดเคลื่อน 
   - **วิธีแก้:** ระบบใช้หลักการ **Noon Normalization** (`setHours(12, 0, 0, 0)`) เพื่อให้แน่ใจว่าวันที่อ้างอิงอยู่ตรงกลางวันเสมอ ทำให้การค้นหาในช่วง `gte: start, lte: end` แม่นยำขึ้นทั้งใน `weeklyPlanRouter`, `dashboardRouter` และหน้า UI
2. **ปัญหา Type Mismatch (User ID)**
   - **ปัญหา:** Session ของ NextAuth จะเก็บ `user.id` เป็น String แต่ในฐานข้อมูล `user_id` เป็น Integer
   - **วิธีแก้:** ต้องใช้ `Number(ctx.session.user.id)` หรือ `parseInt()` ทุกครั้งที่ Query ข้อมูลที่เกี่ยวข้องกับ User จาก Database
3. **Weekly Plan (แผนงานรายสัปดาห์)**
   - ใช้ `weekStartsOn: 0` (วันอาทิตย์) เป็นตัวกำหนดต้นสัปดาห์เสมอ
   - เก็บข้อมูลเป็น JSON object รายวันใน `plan_data`

## 📂 โครงสร้าง Directory ที่สำคัญ
- `src/app/` : Routes ของ Next.js App Router
- `src/components/` : UI Components (shadcn, layout, attendance_card)
- `src/server/routers/` : tRPC Routers (API Endpoints)
- `prisma/` : Schema และ Seed data
- `src/server/scripts/` : Scripts อรรถประโยชน์ (เช่น `sync-google-sheet.ts`)

## 🔑 Environment Variables ที่จำเป็น
อ้างอิงจาก `.env.example`:
- `DATABASE_URL`
- `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (หากมีการต่อ Google Login)
- API Keys ต่างๆ (ถ้ามี)
