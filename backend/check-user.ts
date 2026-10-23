import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function check() {
  const user = await prisma.user.findUnique({
    where: { email: 'demo@financetracker.local' }
  });
  if (user) {
    console.log("EXISTS: true");
    console.log("IS_ACTIVE: " + user.isActive);
    console.log("PASSWORD_HASH_PRESENT: " + (user.passwordHash ? "true" : "false"));
  } else {
    console.log("EXISTS: false");
  }
}

check()
  .catch(console.error)
  .finally(async () => {
    await prisma.\();
  });
