import { Worker } from "bullmq";
import { config as loadEnvironment } from "dotenv";
import { Redis } from "ioredis";
import pino from "pino";
import { readWorkerConfig } from "./config.js";
import { createProcessor } from "./processors.js";
import { createAiProvider } from "./providers/ai.js";
import { createEmailProvider } from "./providers/email.js";
import { createStorageProvider } from "./providers/storage.js";

loadEnvironment({ path: [".env", "../../.env"] });

const config = readWorkerConfig();
const logger = pino({ level: config.LOG_LEVEL, base: { service: "laminaria-worker" } });
const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: true });
const providers = {
  ai: createAiProvider(config),
  email: createEmailProvider(config),
  storage: createStorageProvider(config),
};

const worker = new Worker("laminaria", createProcessor(providers), {
  connection: redis,
  concurrency: config.WORKER_CONCURRENCY,
  lockDuration: 60_000,
});

worker.on("completed", (job) => logger.info({ jobId: job.id, jobName: job.name }, "job completed"));
worker.on("failed", (job, error) =>
  logger.error({ jobId: job?.id, jobName: job?.name, error }, "job failed"),
);
worker.on("error", (error) => logger.error({ error }, "worker error"));

logger.info(
  {
    concurrency: config.WORKER_CONCURRENCY,
    services: {
      ai: providers.ai.configured,
      email: providers.email.configured,
      storage: providers.storage.configured,
    },
  },
  "worker started",
);

async function shutdown(signal: string) {
  logger.info({ signal }, "worker shutting down");
  await worker.close();
  await redis.quit();
  process.exit(0);
}

process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
