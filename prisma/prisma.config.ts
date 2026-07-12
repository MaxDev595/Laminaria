import "dotenv/config";
import { defineConfig, env } from "prisma/config";

// Reference config for Prisma 7. Run commands with:
// pnpm prisma --config prisma/prisma.config.ts <command>
export default defineConfig({
  schema: "schema.prisma",
  migrations: {
    path: "migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
