import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { resolveDbPath } from "./path";

type DB = ReturnType<typeof drizzle<typeof schema>>;

// Singleton across hot reloads in development.
const g = globalThis as unknown as { __pacDb?: DB };

function create(): DB {
  const sqlite = new Database(resolveDbPath());
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  return drizzle(sqlite, { schema });
}

export const db: DB = g.__pacDb ?? (g.__pacDb = create());
export { schema };
