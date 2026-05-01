import { PrismaClient } from "@prisma/client";

async function test() {
  const combinations = [
    "mysql://root:password@localhost:3306/wfh_system",
    "mysql://root:@localhost:3306/wfh_system",
    "mysql://root:root@localhost:3306/wfh_system",
  ];

  for (const url of combinations) {
    console.log(`Testing: ${url}`);
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url,
        },
      },
    });

    try {
      await prisma.$connect();
      console.log("✅ SUCCESS!");
      await prisma.$disconnect();
      return;
    } catch (e: any) {
      console.log(`❌ FAILED: ${e.message.split('\n')[0]}`);
    }
  }
}

test();
