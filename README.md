# PLK WFH & Attendance System

ระบบลงเวลาปฏิบัติงานและขออนุมัติปฏิบัติงานที่บ้าน (Work From Home) สำหรับบุคลากรสาธารณสุข

## 🚀 Tech Stack

- **Frontend**: Next.js 16 (App Router)
- **API Layer**: tRPC (End-to-end typesafe API)
- **Styling**: Tailwind CSS v4.2 + shadcn/ui
- **Icons**: Lucide Icons
- **Database**: MySQL
- **ORM**: Prisma
- **Authentication**: NextAuth.js (MOPH SSO Integration)

## 🛠 การติดตั้ง (Setup)

1. **Clone repository**
   ```bash
   git clone https://github.com/nooknexus/ssj-wfh.git
   cd WFH
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   สร้างไฟล์ `.env` และกำหนดค่าดังนี้:
   ```env
   DATABASE_URL="mysql://root:root@localhost:3306/wfh_system"
   NEXTAUTH_SECRET="your-secret"
   NEXTAUTH_URL="http://localhost:3004"
   ```

4. **Database Setup**
   ```bash
   npx prisma generate
   npx prisma db push
   # หรือรัน seed เพื่อข้อมูลเริ่มต้น
   npm run seed
   ```

5. **Run Development Server**
   ```bash
   npm run dev
   ```
   เข้าใช้งานได้ที่: `http://localhost:3004`

## 📁 โครงสร้างโฟลเดอร์ (Folder Structure)

- `src/app`: Next.js App Router (Pages & Layouts)
- `src/components`: UI Components (Shared & Feature-based)
- `src/server`: Backend logic (tRPC Routers, Services, Prisma)
- `src/trpc`: tRPC Client configuration
- `prisma`: Database schema & migrations

## 🗺️ แผนการพัฒนา (Roadmap & Memory)
สำหรับรายละเอียดสถานะการพัฒนาของแต่ละฟีเจอร์ และแผนการพัฒนาฟีเจอร์ที่ยังไม่เสร็จ (เช่น ระบบจองรถ, ระบบงานสารบรรณ) สามารถดูได้ที่ [ROADMAP.md](./ROADMAP.md)

## 📜 กฎการพัฒนา (Development Rules)

- ใช้ **TypeScript** เสมอ (Strict Mode)
- ใช้ **Named Exports** เท่านั้น
- **RSC (React Server Components)** เป็นค่าเริ่มต้น ใช้ `'use client'` เมื่อจำเป็นเท่านั้น
- ทุกฟีเจอร์ใหม่ต้องมีการเขียน **Unit Test** (Vitest)
