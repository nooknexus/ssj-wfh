คุณคือ Agentic Engineering ต้องการให้คุณเขียน Prompt เพื่อรวมระบบทั้ง4อันด้านล่างเป็นระบบเดียวกัน โดยระบบมีชื่อว่า "PLK WFH System" เป็นระบบที่ใช้ในงานของสำนักงานสาธารณสุขจังหวัดพิษณุโลก เพื่อให้เจ้าหน้าใช้งานในระหว่างที่ทำงาน Work From Home โดยใช้ SSO ของกระทรวงสาธารณสุข(ProviderID)ในการยืนยันตัวตนเข้าใช้งานระบบ แทนการ Login แบบเดิม ให้พัฒนาโดยใช้ .agents/PROVIDER.md เป็นแนวทางหลักในการพัฒนา พอล็อกอินเข้ามาแล้ว ระบบจะแสดงระบบต่างๆเพื่อให้เลือกเข้าใช้ ซึ่งประกอบด้วยระบบดังนี้:

1. ระบบลาออนไลน์ (อนุมัติ 2 ขั้นตอน)
2. ระบบขอใช้รถยนต์ราชการ (อนุมัติ 2 ขั้นตอน)
3. ระบบงานสารบรรณอิเล็กทรอนิกส์
4. ระบบลงเวลาและแจ้งลาปฏิบัติงาน

และสามารถกดโปรไฟล์ดูข้อมูลส่วนตัวได้ โดยผมมีตัวอย่างของแต่ละระบบตามตัวอย่างpromptด้านล่างนี้ให้คุณปรับแก้ให้เป็นระบบเดียวกัน โดยคุณจะต้องพัฒนาโดยอ้างอิงจาก GEMINI.md เป็นแนวทางในการพัฒนา จากตัวอย่างจะใช้Google Apps Script (GAS) ไม่ต้องสนใจ


--------------------------------------------------------------------------------------------------------------
ระบบลาออนไลน์ (อนุมัติ 2 ขั้นตอน)
🎯 ROLE
คุณคือ Senior Full-Stack Developer + UI/UX Designer + System Architect ระดับ Startup Unicorn
เชี่ยวชาญ:
- Google Apps Script (GAS) สำหรับ Backend & API
- HTML + TailwindCSS + Vanilla JS สำหรับ Frontend (Single Page Application)
- Responsive Design + Mobile First
- UX Psychology + Micro Interaction (Glassmorphism)
- Telegram Bot API
- การสร้างรายงานแบบ Print Media (A4 Landscape) และ PDF

🧠 TASK
ให้คุณสร้างโค้ดระบบ: “ระบบบริหารจัดการการลา (Leave Management System) แบบ SaaS Ready”
โดยต้องใช้งานได้จริง (Production Ready) รองรับ Mobile 100% และ Deploy เป็น Web App บน Google Apps Script ได้ทันที
🧩 FEATURE REQUIREMENTS แบ่งตาม ROLES (3 ระดับ)
1. Admin (ผู้ดูแลระบบ)
- Dashboard: ดูภาพรวมคำขอลาล่าสุด
- จัดการผู้ใช้งาน (User Management): หน้าจอเพิ่ม, แก้ไข (ชื่อ, รหัส, บทบาท, โควต้า), ลบ ผู้ใช้งาน (Full CRUD)
- จัดการประเภทการลา: เปิด/ปิด ประเภทการลาได้
- ตั้งค่าระบบ: กำหนดปีงบประมาณ และตั้งค่าเชื่อมต่อ Telegram Bot
- ระบบรายงาน (Print/PDF):
1) พิมพ์รายงานสรุปสถิติการลาประจำปีงบประมาณ (A4 แนวนอน) แบ่งเป็น 11 ประเภทการลาตามแบบฟอร์มราชการ (บังคับให้ตารางกางเต็ม 100% ของหน้ากระดาษ และซ่อนเมนูตอนพิมพ์)
2) กดดูรายละเอียดประวัติการลารายบุคคล และสั่งพิมพ์รายงานเฉพาะบุคคลได้
2. Director (ผู้อำนวยการ)
- Dashboard: มี Stat Cards สรุปจำนวนพนักงาน, คำขอที่อนุมัติ, รอพิจารณา, ไม่อนุมัติ
- กราฟสถิติ (Chart.js): Pie Chart แสดงสัดส่วนประเภทการลาภาพรวม และ Bar Chart แสดง Top 5 พนักงานที่ใช้วันลาสูงสุด
- ระบบอนุมัติ: อนุมัติ / ปฏิเสธคำขอลา พร้อมระบุเหตุผล
- ยื่นขอลา: ผู้อำนวยการสามารถเขียนใบลาของตนเองได้
3. User (พนักงาน)
- Dashboard: Stat Cards (โควต้า, ใช้ไป, รออนุมัติ, คงเหลือ) พร้อม Doughnut Chart แสดงสัดส่วนวันลาที่ใช้ไป
- ขออนุญาตลา: เลือกประเภทการลา (11 ประเภท), เลือกวันเริ่มต้น-สิ้นสุด (ระบบคำนวณจำนวนวันอัตโนมัติ) และกรอกเหตุผล
- Timeline: ดูสถานะคำขอลาของตนเอง (รออนุมัติ, อนุมัติ, ปฏิเสธ)
- โปรไฟล์: แก้ไขชื่อและอัปเดตรหัสผ่านของตนเองได้

🗄️ DATABASE (Google Sheets via Apps Script)
สร้างฟังก์ชัน `setupSystem()` ใน Code.gs สำหรับสร้างชีตอัตโนมัติ:
- users (id, username, password, name, role, department, quota_leave)
- leave_requests (id, user_id, type, start_date, end_date, days, reason, status, director_reason, created_at)
- leave_types
*ข้อควรระวัง Backend:* ใน Apps Script ให้ใช้ `getDisplayValues()` และ `.trim()` เสมอเมื่ออ่านข้อมูล เพื่อป้องกันระบบล่มจาก Date Object และป้องกันบัคจากช่องว่าง (Whitespace)

🎨 UI/UX REQUIREMENTS (🔥หัวใจ Unicorn)
- Design Concept: Glassmorphism (พื้นหลังเบลอ), Soft Shadow, Minimal, Premium
- Color Palette: Primary (#6C63FF), Success (#00C9A7), Danger (#FF6B6B), Warning (#FFC75F)
- Font: Kanit หรือ Prompt

📦 OUTPUT FORMAT
ให้สร้างโค้ดทั้งหมด 2 ไฟล์แบบสมบูรณ์ 100% (ห้ามใช้คำว่า "รหัสเดิม" หรือ "existing code" ให้เขียนมาเต็มๆ):
1. `Code.gs` : โค้ด Backend (API, CRUD, Telegram, setupSystem)
2. `index.html` : โค้ด Frontend ทั้งหมด (HTML, Tailwind Classes, CSS Print Media, Vanilla JS Logic พร้อม MockDB สำหรับทดสอบบน UI ก่อนนำไปผูก GAS)

🔥 คำสั่งสุดท้าย:
“สร้างระบบทั้งหมดตามรายละเอียดนี้แบบ FULL STACK โค้ดสมบูรณ์ 100% พร้อม UI ระดับ Unicorn Startup และสามารถ Deploy ใช้งานบน Google Apps Script ได้จริงทันที”
------------------------------------------------------------------------------------------------------------------------------
ระบบขอใช้รถราชการ (อนุมัติ 2 ขั้นตอน)
"Act as an Expert Full-Stack Developer. Build a 'Corporate/Government Vehicle Reservation System with a 2-Step Approval Workflow' using Google Apps Script (GAS), Tailwind CSS, and Google Sheets.
1. Architecture & UI:
Frontend: Single HTML file using Tailwind CSS for a professional, clean administrative interface. Use Lucide Icons and SweetAlert2.
Layout: Multi-role Dashboard with dynamic sidebar/navigation based on user login.
2. Database Structure (Google Sheets):
users: id, username, password, fullName, role (staff, manager, admin), department.
vehicles: id, licensePlate, brand_model, seats, status (available, maintenance).
drivers: id, fullName, phone.
reservations: id, userId, userName, department, objective, destination, startDate, endDate, passengers, managerStatus (pending/approved/rejected), adminStatus (pending/approved/rejected), vehicleId, driverId, remark, timestamp.
3. Key Features & The 2-Step Workflow:
Auth System: Role-Based Access Control (RBAC) supporting 3 roles: 'staff', 'manager', 'admin'.
Role 1: Staff (Requester):
Can submit a new vehicle request form (Date/Time, Destination, Objective, Passengers).
Dashboard shows their request history with a visual progress tracker: Pending Manager -> Pending Admin -> Approved & Assigned.
Role 2: Manager (Approver Step 1):
Sees a list of pending requests only from their department.
Can click 'Approve' (moves request to Admin) or 'Reject' (ends the workflow).
Role 3: Admin / Fleet Manager (Approver Step 2):
Sees requests that have been approved by Managers.
To give final approval, the Admin must select a vehicleId and driverId from a dropdown inside an Assignment Modal.
Can view overall vehicle usage/schedules.
4. UI Components to include:
Status Badges: Use clear colors (e.g., Pending Manager: Yellow, Pending Admin: Blue, Approved: Green, Rejected: Red).
Approval Workflow UI: A visual stepper on the request detail card showing the current stage of approval.
Assignment Modal (Admin): A specific popup for Admins to assign a car and driver before hitting the final 'Approve' button.
5. Technical Requirements:
Use google.script.run for backend interactions.
Implementation must include a MockDB logic in the frontend containing sample data for all 3 roles, vehicles, and drivers, allowing the UI and interactions to be previewed immediately.
All UI text, forms, buttons, and system messages must be in Thai language (ภาษาไทย) using official/polite terminology (e.g., ขออนุมัติใช้รถราชการ).
Ensure validation logic prevents overlapping bookings for the same vehicle/driver (at least display a warning in the Admin modal).
Please generate the complete, production-ready 'index.html' and 'code.gs' files."
-----------------------------------------------------------------------------------------------------------------------------
Act as an Expert Full-Stack Developer (GAS & Tailwind CSS). Build a "Smart Meeting Room Booking System" (ระบบจองใช้ห้องประชุมออนไลน์) using Google Apps Script and Google Sheets.
# 1. Core Concept & Tech Stack
- Frontend: Single HTML file using Tailwind CSS, Lucide Icons, and FullCalendar.js (optional but recommended for visual scheduling).
- Backend: Google Apps Script (code.gs) with Google Sheets as DB.
- Objective: Users can view available rooms and book specific time slots.
# 2. Database Structure (Google Sheets)
The backend must auto-setup these sheets:
1. `resources`: id, name, description, capacity, image (Drive URL), status (Active/Maintenance).
2. `bookings`: id, resourceId, userId, userName, date, timeStart, timeEnd, reason, status (Pending/Approved/Rejected).
3. `users`: id, username, password, fullName, department.
# 3. Features: User Side (Booking)
- Resource Gallery: Display cards of available resources with "Book Now" buttons.
- Booking Form:
- Date picker.
- Time slot selection (e.g., 09:00 - 10:00).
- Validation: Check on the backend if the slot is already booked for that resource before saving.
- My Bookings: A list showing the user's personal booking history and current status (Pending/Approved).
# 4. Features: Admin Side (Management)
- Dashboard: Overview of today's bookings.
- Resource Manager: CRUD for adding new rooms or equipment, including uploading photos to Drive.
- Approval System: List of all pending bookings with "Approve" and "Reject" buttons.
- Conflict Checker: Highlight bookings that overlap in time (if any).
# 5. UI/UX Design Specifications
- Style: Modern, clean, and organized (Professional look).
- Feedback: Use SweetAlert2 for success/error messages.
- Status Colors:
- Pending: Yellow/Orange.
- Approved: Green.
- Rejected: Red.
- Responsive: Card-based layout for mobile users.
# 6. Coding Standards & Logic
- All UI text, buttons, and alerts must be in Thai (ภาษาไทย).
- Implement a `checkAvailability(resourceId, date, start, end)` function in GAS to prevent double bookings.
- Use `google.script.run` with success/failure handlers.
- Include "Mock Data" logic for testing the UI locally.
Please generate the complete `index.html` and `code.gs` files.
------------------------------------------------------------------------------------------------------------------------------
ระบบงานสารบรรณรับ-ส่ง เพื่อให้ จนท. ธุรการของแต่ละกลุ่มงานอัพโหลดเอกสารจากงานธุรการกลาง เข้าสู่ระบบ แล้วในหัวหน้ากลุ่มงานเลือกว่าเอกสารนี้จะมอบหมายให้ใครรับผิดชอบ โดยให้มีสถานะเป็น Pending เมื่อลูกน้องรับเรื่องแล้วจะขึ้นว่า In Progress พอลูกน้องเข้ามาอัพเดทสถานะเอกสารแล้วเสร็จให้ขึ้นว่า Completed

1.หน้าแรก(intro) button card 5 column เติมสีพื้นหลังทึบ แต่ละสี ในรูปแบบ color gradient ได้แก่
-หนังสือรับ (แสดงจำนวนหนังสือรับทั้งหมด, progress fill จากจำนวนทั้งหมด)
-หนังสือส่ง (แสดงจำนวนหนังสือส่งทั้งหมด,progress fill จากจำนวนทั้งหมด)
-คำสั่ง (แสดงจำนวนคำสั่งทั้งหมด,progress fill จากจำนวนทั้งหมด)
-บันทึกข้อความ (แสดงจำนวนบันทึกข้อความทั้งหมด,progress fill จากจำนวนทั้งหมด)
-สถิติ(แสดงจำนวนทั้งหมด)

2.หน้าหนังสือรับ
-ปุ่มกลับหน้าแรก
-modal การเพิ่มหนังสือรับ ได้แก่
เลขที่หนังสือ(กรอกข้อมูล),
จากหน่วยงาน(กรอกข้อมูล),
เรื่อง(กรอกข้อมูล),
วันที่รับ,
อัพโหลดไฟล์อแนบ(ไม่บังคับ รองรับหลายไฟล์),
ตารางแสดงข้อมูล(ค้นหา,เพิ่ม,ลบ,แก้ไข)

3.หน้าหนังสือส่ง
-ปุ่มกลับหน้าแรก
-modal การเพิ่มหนังสือส่ง ได้แก่
เลขที่ส่ง(กรอกข้อมูล),
ถึง(กรอกข้อมูล),
เรื่อง(กรอกข้อมูล),
วันที่ส่ง,
อัพโหลดไฟล์อแนบ(ไม่บังคับ รองรับหลายไฟล์),
ตารางแสดงข้อมูล(ค้นหา,เพิ่ม,ลบ,แก้ไข)


แดชบอร์ดแสดง
-จำนวนทั้งหมด,
-หนังสือรับ (แสดงจำนวนหนังสือรับทั้งหมด, progress fill จากจำนวนทั้งหมด)
-หนังสือส่ง (แสดงจำนวนหนังสือส่งทั้งหมด,progress fill จากจำนวนทั้งหมด)
-คำสั่ง (แสดงจำนวนคำสั่งทั้งหมด,progress fill จากจำนวนทั้งหมด)
-บันทึกข้อความ (แสดงจำนวนบันทึกข้อความทั้งหมด,progress fill จากจำนวนทั้งหมด)
-chart.js (bar) จำนวนแต่ละอัน เติมสีแท่งกราฟคนละสี
6.footer : ระบบงานสารบรรณรับ-ส่ง-คำสั่ง-บันทึกข้อความ โรงเรียนบ้านเสยเสย(ไม่แสดงหน้าแรก)
7.font kanit google ,Ui Style Modern , responsive, icon อิโมจิ สวยงามทันสมัย , จัด layout pading margin ให้สวยงามเหมาะสม , (loading spin ทุกกระบวนการทำงาน) , การเพิ่ม(modal) ,การแก้ไข(modal) , การลบ(sweet confirm), การแจ้งเตือน(sweet alert)
--------------------------------------------------------------------------------------------------------------------
ระบบลงเวลาและแจ้งลาปฏิบัติงาน
Prompt: ช่วยเขียนโค้ด Google Apps Script (Code.gs) สำหรับเป็น Backend ของ "ระบบลงเวลาปฏิบัติงานครู" โดยเชื่อมต่อกับ Google Sheets และรองรับฟังก์ชันจากหน้า HTML ดังนี้:โครงสร้างฐานข้อมูล (Google Sheets):สร้างฟังก์ชันเช็คและสร้าง Sheet อัตโนมัติหากยังไม่มี ได้แก่:'Teachers': [ID, Name, Position, Department, Email, Password]'Attendance': [Date, Name, Status, CheckInTime, CheckOutTime, IP, Location, TeacherID]'Settings': [Key, Value] (สำหรับเก็บ School Name, Logo URL, Telegram Token, Chat ID)ฟังก์ชันหลักที่ต้องมี:doGet(): สำหรับ Serve ไฟล์ Index.htmllogin(email, password): ตรวจสอบข้อมูลใน Sheet 'Teachers' และ 'Admin' (กำหนด Admin ไว้ในโค้ดหรือ Sheet)checkIn(teacherId, status, ip, location): บันทึกข้อมูลลง Sheet 'Attendance'*สถานะ: 'ปกติ', 'สาย' (เช็คจากเวลาปัจจุบันเทียบกับ 08:30 น.), หรือ 'ลา'checkOut(teacherId): ค้นหาแถวของวันนี้ที่มีเฉพาะเวลาเข้าแต่ยังไม่มีเวลาออก แล้วบันทึกเวลาออกgetTodayStatus(teacherId): เช็คว่าวันนี้ครูคนนี้ลงเวลาไปหรือยัง เพื่อส่งสถานะกลับไปหน้า UIgetDashboardData(): สรุปสถิติวันนี้ (มา, สาย, ขาด, ลา) และส่งข้อมูลสรุป AI Insight แบบง่ายๆgetAllAttendance(): ดึงข้อมูลการลงเวลาทั้งหมดสำหรับหน้า Admin LogsgetTeachers() / saveTeacher(data) / deleteTeacher(id): ระบบ CRUD จัดการข้อมูลครูgetSystemSettings() / saveSettings(data): จัดการข้อมูลโรงเรียนและ Telegramระบบแจ้งเตือน (Telegram Notification):สร้างฟังก์ชัน sendTelegram(message) โดยดึง Token และ Chat ID จาก Sheet 'Settings'ให้เรียกใช้การแจ้งเตือนเมื่อมีการ 'เข้างาน' และ 'แจ้งลา'ข้อกำหนดทางเทคนิค:ใช้หลักการจัดการวันที่แบบไทย (GMT+7)มีการ Lock Service ป้องกันการบันทึกข้อมูลซ้อนกัน (Concurrency Control)คืนค่ากลับเป็น Object {success: true/false, message: "...", data: ...} ทุกครั้ง

ฟีเจอร์รายละเอียดลงชื่อเข้างาน (Check-in)
-บันทึกเวลาเข้างาน เลือกประเภท WFH / เข้าสำนักงาน / ไปราชการ / ออกปฏิบัติงานพื้นที่

-ลงชื่อออกงาน (Check-out)
บันทึกเวลาออกงาน พร้อมสรุปชั่วโมงทำงาน

-อัปโหลดรูปภาพ
แนบรูปภาพหลักฐานการปฏิบัติงานสูงสุด 3 รูป (JPG / PNG ขนาดสูงสุด 5MB ต่อรูป)

-บันทึก GPS
บันทึกพิกัดตำแหน่งอัตโนมัติพร้อม Check-in / Check-out

-บันทึกภารกิจ
อธิบายงานที่ปฏิบัติในวันนั้นๆ

-ประวัติการลงชื่อ
ดูประวัติย้อนหลัง กรองตามประเภทและช่วงวันที่ พร้อมรูปภาพที่แนบ

-แจ้งเตือน Check-out
ระบบแจ้งเตือนอัตโนมัติเมื่อถึงเวลา 15:30 น. หากยังไม่ได้ Check-out

-วางแผนงานรายสัปดาห์
วางแผนประเภทการปฏิบัติงานล่วงหน้าทุกวัน (WFH / สำนักงาน / ราชการ / พื้นที่ / ลา)

-บันทึกผลการปฏิบัติงาน
บันทึกโน้ตสรุปผลงาน พร้อมแนบไฟล์หลักฐานสูงสุด 5 ไฟล์ต่อวัน

-สรุปการลา / แผนงานรายเดือน
ดูสรุปจำนวนวันแต่ละประเภทในแต่ละเดือน (ลา / WFH / สำนักงาน / ราชการ / พื้นที่)