import "dotenv/config";
import { defineConfig } from "drizzle-kit";
import { resolveDbPath } from "./src/db/path";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: resolveDbPath() },
});
