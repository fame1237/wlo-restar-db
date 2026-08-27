# DemonDex

เว็บ CRUD ภาษาไทยสำหรับค้นหาและจัดการชื่อปีศาจกับธาตุ สร้างด้วย **Vite + TypeScript + Supabase** และพร้อม deploy บน Vercel

## โหมดการทำงาน

- ถ้าไม่มี `.env` เว็บจะทำงานเป็นโหมดตัวอย่างและเก็บข้อมูลใน `localStorage`
- ถ้ามีค่า Supabase ครบ เว็บจะอ่านข้อมูลส่วนกลางจาก PostgreSQL
- ผู้เยี่ยมชมค้นหาและดูข้อมูลได้
- มีบัญชีผู้ดูแลเพียงบัญชีเดียวสำหรับเพิ่ม แก้ไข และลบข้อมูล โดยบังคับสิทธิ์ซ้ำที่ Supabase RLS

## เริ่มใช้งานในเครื่อง

```powershell
npm install
npm run dev
```

เปิด `http://localhost:5173`

ตรวจสอบก่อน deploy:

```powershell
npm run build
npm run preview
```

## เชื่อม Supabase

1. สร้าง Supabase project
2. เปิด **SQL Editor** แล้วรัน [`supabase/schema.sql`](supabase/schema.sql)
3. ถ้าต้องการข้อมูลตัวอย่าง ให้รัน [`supabase/seed.sql`](supabase/seed.sql)
4. ไปที่ **Project Settings > API** แล้วคัดลอก Project URL และ Publishable key
5. คัดลอก `.env.example` เป็น `.env.local` แล้วใส่ค่า:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
VITE_ADMIN_USERNAME=admin1234
VITE_ADMIN_EMAIL=admin1234@demondex.local
```

6. ใน **Authentication > URL Configuration** ใส่ Site URL ของเว็บจริง และเพิ่ม `http://localhost:5173` ใน Redirect URLs ระหว่างพัฒนา

> `VITE_` variables จะถูกส่งไปยัง browser จึงต้องใช้เฉพาะ Publishable/Anon key เท่านั้น ห้ามใส่ `service_role` หรือ secret key ความปลอดภัยของข้อมูลในโปรเจกต์นี้บังคับด้วย RLS จาก `schema.sql`

### ตั้งค่าบัญชีผู้ดูแล

- ผู้เยี่ยมชมทุกคนอ่านข้อมูลได้
- หน้าเว็บไม่มีปุ่มสมัครสมาชิก และรับชื่อผู้ใช้ `admin1234` เท่านั้น
- สร้างผู้ใช้ `admin1234@demondex.local` จาก **Authentication > Users > Add user** ใน Supabase Dashboard
- ปิด **Allow new users to sign up** ใน Authentication settings
- รัน [`supabase/admin-only.sql`](supabase/admin-only.sql) เพื่อให้ฐานข้อมูลยอมรับการเขียนจากอีเมลผู้ดูแลนี้เท่านั้น
- รหัสผ่านไม่ถูกเก็บใน frontend และต้องตั้งหรือเปลี่ยนจาก Supabase Authentication เท่านั้น

## นำขึ้น GitHub และ Vercel

1. สร้าง GitHub repository แบบ Private แล้ว push โฟลเดอร์นี้ขึ้นไป
2. ใน Vercel เลือก **Add New Project** และ Import repository
3. Vercel จะตรวจพบ Vite อัตโนมัติ โดยใช้ Build Command `npm run build` และ Output Directory `dist`
4. เพิ่ม Environment Variables สองตัวเดียวกับ `.env.local`
5. Deploy แล้วนำ URL ที่ได้ไปตั้งเป็น Site URL ใน Supabase Authentication

หลังจากนั้นทุกครั้งที่ push เข้า branch หลัก Vercel จะ build และ deploy เวอร์ชันใหม่ให้อัตโนมัติ

## โครงสร้างสำคัญ

```text
src/main.ts          UI, CRUD, Supabase Auth และ data layer
supabase/schema.sql  ตาราง, validation, trigger และ RLS policies
supabase/seed.sql    ข้อมูลตัวอย่าง
.env.example         ตัวอย่างค่าการเชื่อมต่อแบบ public
```

## คำสั่ง

- `npm run dev` — development server
- `npm run typecheck` — ตรวจ TypeScript
- `npm run build` — ตรวจ TypeScript และสร้าง production bundle
- `npm run preview` — เปิด production bundle ในเครื่อง
