# Deployment Guide (PLK WFH System)

ไฟล์นี้อธิบายขั้นตอนการนำระบบ **PLK WFH System** ขึ้นสู่สภาพแวดล้อม Production

## 📋 Prerequisites
1. **Node.js**: เวอร์ชัน 20.x ขึ้นไป
2. **Database**: MySQL Server
3. **Process Manager**: PM2 (แนะนำสำหรับการรัน Node.js บน Production Server)
4. **Web Server/Reverse Proxy**: Nginx (แนะนำสำหรับการตั้งค่า SSL และ Domain)

---

## 🚀 ขั้นตอนการติดตั้ง (Deployment Steps)

### 1. โคลนโปรเจคและติดตั้ง Dependencies
```bash
# Clone the repository
git clone <repository-url>
cd plk-wfh-system

# Install dependencies (แนะนำให้ใช้เครื่องมือ package manager ที่คุ้นเคย npm/yarn/pnpm/bun)
npm install
```

### 2. ตั้งค่า Environment Variables
ทำการคัดลอกไฟล์ `.env.example` เป็น `.env` และแก้ไขค่าให้ตรงกับ Production
```bash
cp .env.example .env
```
**ค่าที่ต้องให้ความสำคัญใน `.env`:**
- `DATABASE_URL`: Connection String ไปยัง Production MySQL
- `NEXTAUTH_URL`: URL จริงของระบบ (เช่น `https://wfh.plkhealth.go.th`)
- `NEXTAUTH_SECRET`: สุ่มรหัสลับใหม่ (ใช้คำสั่ง `openssl rand -base64 32` เพื่อสร้าง)

### 3. เตรียมฐานข้อมูล (ยก Database จาก Dev ไป Production)
เนื่องจากต้องการใช้ข้อมูลทั้งหมดจาก Development ไปยัง Production ให้ทำการ Export และ Import ฐานข้อมูลทั้งหมดดังนี้

**ฝั่งเครื่อง Development (Export):**
ให้ทำการ Export ฐานข้อมูลออกมาเป็นไฟล์ `.sql`
```bash
mysqldump -u [username] -p [database_name] > wfh_dev_backup.sql
```

**ฝั่งเครื่อง Production (Import):**
นำไฟล์ `wfh_dev_backup.sql` ไปยังเครื่อง Production และทำการ Import เข้าสู่ฐานข้อมูลที่เตรียมไว้
```bash
mysql -u [username] -p [database_name] < wfh_dev_backup.sql
```

หลังจาก Import ข้อมูลเสร็จแล้ว ให้ทำการ Generate Prisma Client เพื่อให้โค้ดรู้จักโครงสร้าง Database
```bash
npx prisma generate
```
*(หมายเหตุ: ไม่จำเป็นต้องรัน `npx prisma db push` หรือ `npm run seed` เพราะโครงสร้างและข้อมูลทั้งหมดถูกยกมาจาก Dev เรียบร้อยแล้ว)*

### 4. Build ระบบ
รวบรวมและปรับปรุงโค้ดสำหรับ Production
```bash
npm run build
```

### 5. รันระบบด้วย PM2
เพื่อให้ระบบทำงานอยู่เบื้องหลังเสมอและทำงานต่ออัตโนมัติหากมีการรีสตาร์ทเซิร์ฟเวอร์
```bash
# ติดตั้ง PM2 (หากยังไม่มี)
npm install -g pm2

# รันระบบ
pm2 start npm --name "plk-wfh" -- start

# บันทึกสถานะ PM2 ให้ทำงานตอนเปิดเครื่อง
pm2 save
pm2 startup
```

### 6. ตั้งค่าการแจ้งเตือนเตือนลืมออกงาน (Cron Job)
เพื่อให้ระบบสามารถยิงแจ้งเตือนผ่าน MOPH Alert ไปยังพนักงานที่ลืมลงเวลาออกงานในเวลา 17:00 น. ของทุกวัน ให้ตั้งค่า `crontab` บนเซิร์ฟเวอร์ดังนี้:

1. เปิดหน้าต่างแก้ไขการตั้งเวลา (หากระบบให้เลือก Editor แนะนำให้เลือก `nano`)
   ```bash
   crontab -e
   ```
2. นำคำสั่งด้านล่างไปวางต่อท้ายไฟล์ (อย่าลืมเปลี่ยน `your-domain.com` และใส่ค่า `CRON_SECRET` ให้ตรงกับไฟล์ `.env`):
   ```bash
   # ยิงแจ้งเตือนเตือนให้ออกงาน (WFH System) เวลา 17:00 น. ของทุกวัน
   0 17 * * * curl -s -H "Authorization: Bearer ใส่ค่า_CRON_SECRET_ของคุณที่นี่" -X GET "https://your-domain.com/api/cron/checkout-reminder" > /dev/null 2>&1
   ```
3. บันทึกและออกจาก Editor (ใน `nano` กด `Ctrl + O` -> `Enter` -> `Ctrl + X`) ระบบจะเริ่มนับเวลาทำงานอัตโนมัติ

---

## 🌐 การตั้งค่า Nginx (Reverse Proxy)
หากใช้ Nginx เพื่อรับ Traffic จากภายนอก ให้เพิ่ม Configuration ดังนี้:

```nginx
server {
    listen 80;
    server_name wfh.yourdomain.com; # เปลี่ยนเป็นโดเมนจริง

    location / {
        proxy_pass http://localhost:3000; # เปลี่ยนพอร์ตหากคุณกำหนดพอร์ตอื่นตอน start
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # ถ้าระบบใช้ NextAuth ให้แน่ใจว่าส่ง Header เหล่านี้ครบถ้วน
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
*แนะนำให้ทำ SSL (HTTPS) โดยใช้ Let's Encrypt (Certbot)*

---

## 🔄 การอัปเดตระบบในภายหลัง (Continuous Deployment)
เมื่อมีการอัปเดตโค้ดใหม่ ให้ทำตามขั้นตอนนี้:

```bash
cd /path/to/plk-wfh-system
git pull origin main

npm install
npx prisma generate
npx prisma db push   # ถ้ามีการแก้ schema.prisma

npm run build
pm2 restart plk-wfh
```

---

## 🛠 Troubleshooting เบื้องต้น
- **ปัญหา Login ไม่ได้ / NextAuth Error:** ตรวจสอบว่า `NEXTAUTH_URL` ตรงกับ URL จริงที่ผู้ใช้เข้าใช้งาน และตั้งค่า Callback URL ใน OAuth Provider ถูกต้อง
- **ปัญหา Database ปฏิเสธการเชื่อมต่อ:** ตรวจสอบพอร์ต Username/Password ของ MySQL ว่าถูกต้องใน `DATABASE_URL`
- **ปัญหาระบบหา Module ไม่เจอหลังอัปเดต:** ให้ลบโฟลเดอร์ `.next` และ `node_modules` แล้วรัน `npm install` ใหม่
