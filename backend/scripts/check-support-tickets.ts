import { prisma } from "../src/config/prisma";

/** Lists all ERROR and SUGGESTION support tickets (DOUBT tickets are auto-answered by AI and
 * usually don't need developer attention). Run with: `npx tsx scripts/check-support-tickets.ts` */
async function main() {
  const tickets = await prisma.supportTicket.findMany({
    where: { type: { in: ["ERROR", "SUGGESTION"] } },
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  console.log(`Total ERROR/SUGGESTION tickets: ${tickets.length}\n`);
  for (const t of tickets) {
    console.log(
      JSON.stringify(
        {
          id: t.id,
          type: t.type,
          status: t.status,
          subject: t.subject,
          description: t.description,
          errorContext: t.errorContext,
          adminResponse: t.adminResponse,
          user: t.user ? `${t.user.name} <${t.user.email}>` : t.userId,
          createdAt: t.createdAt.toISOString(),
        },
        null,
        2
      )
    );
    console.log("---");
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
