const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const depts = await prisma.department.findMany({
    include: { _count: { select: { users: true } } }
  });
  console.log(depts);
  if (depts.length > 0) {
    console.log("Type of count:", typeof depts[0]._count.users);
  }
  await prisma.$disconnect();
}
run().catch(console.error);
