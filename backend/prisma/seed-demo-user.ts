import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = "demo@financetracker.local";
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    console.log("Demo user already exists; leaving its credentials and data unchanged.");
    return;
  }

  await prisma.user.create({
    data: {
      name: "Demo User",
      email,
      passwordHash: await bcrypt.hash("Demo@1234", 12),
      role: "USER",
      setting: { create: { currency: "INR" } },
    },
  });

  console.log("Demo user created.");
}

main()
  .catch((error: unknown) => {
    console.error("Failed to create demo user:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
