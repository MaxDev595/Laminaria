import { config as loadEnvironment } from "dotenv";

import { buildApplication } from "./app.js";

loadEnvironment({ path: [".env", "../../.env"] });

async function main(): Promise<void> {
  const application = await buildApplication();
  let closing = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (closing) return;
    closing = true;
    application.app.log.info({ signal }, "Shutting down Laminaria API");
    await application.app.close();
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  await application.app.listen({
    host: application.config.host,
    port: application.config.port,
  });
  application.app.log.info({ url: application.config.publicApiUrl }, "Laminaria API is ready");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
