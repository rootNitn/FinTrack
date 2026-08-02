import { createApp } from "./app";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { prisma } from "./config/prisma";
import { startScheduledJobs } from "./jobs/scheduler";

async function bootstrap() {
  await prisma.$connect();
  logger.info("✅ Database connected");

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 API server listening on http://localhost:${env.PORT}`);
  });

  startScheduledJobs();

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("Fatal error during bootstrap:", err);
  process.exit(1);
});
