import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding departments...')
  
  const departments = [
    { name: 'กลุ่มงานบริหารทั่วไป', code: 'ADMIN' },
    { name: 'กลุ่มงานพัฒนายุทธศาสตร์สาธารณสุข', code: 'STRATEGY' },
    { name: 'กลุ่มงานส่งเสริมสุขภาพ', code: 'PROMOTION' },
    { name: 'กลุ่มงานควบคุมโรคติดต่อ', code: 'CD' },
    { name: 'กลุ่มงานนิติการ', code: 'LEGAL' },
    { name: 'กลุ่มงานคุ้มครองผู้บริโภคและเภสัชสาธารณสุข', code: 'FDA' },
    { name: 'กลุ่มงานประกันสุขภาพ', code: 'INSURANCE' },
    { name: 'กลุ่มงานทรัพยากรบุคคล', code: 'HR' },
    { name: 'กลุ่มงานอนามัยสิ่งแวดล้อมและอาชีวอนามัย', code: 'ENV' },
    { name: 'กลุ่มงานควบคุมโรคไม่ติดต่อ สุขภาพจิตและยาเสพติด', code: 'NCD' },
    { name: 'กลุ่มงานทันตสาธารณสุข', code: 'DENTAL' },
    { name: 'กลุ่มงานการแพทย์แผนไทยและการแพทย์ทางเลือก', code: 'THAI_MED' },
  ]

  for (const dept of departments) {
    await prisma.department.create({
      data: dept,
    })
  }

  console.log('Seeding leave types...')

  const leaveTypes = [
    { name: 'ลาป่วย', code: 'SICK', max_days: 60, sort_order: 1 },
    { name: 'ลากิจส่วนตัว', code: 'PERSONAL', max_days: 45, sort_order: 2 },
    { name: 'ลาพักผ่อน', code: 'VACATION', max_days: 10, sort_order: 3 },
    { name: 'ลาคลอดบุตร', code: 'MATERNITY', max_days: 90, sort_order: 4 },
    { name: 'ลาอุปสมบท', code: 'ORDINATION', max_days: 120, sort_order: 5 },
  ]

  for (const lt of leaveTypes) {
    await prisma.leaveType.create({
      data: lt,
    })
  }

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
