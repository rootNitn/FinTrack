import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { seedDemoData } from "../src/utils/seed-demo-data";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = "demo@financetracker.local";
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  const demoUser = existingUser ?? await prisma.user.create({
    data: {
      name: "Demo User",
      email,
      passwordHash: await bcrypt.hash("Demo@1234", 12),
      role: "USER",
      setting: { create: { currency: "INR" } },
    },
  });

  const seeded = await prisma.$transaction(
    (tx) => seedDemoData(tx, demoUser.id),
    { timeout: 30000 }
  );
  console.log(seeded ? "Demo sample data created." : "Demo sample data already exists; leaving it unchanged.");
}

main()
  .catch((error: unknown) => {
    console.error("Failed to create demo user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
