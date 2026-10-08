import path from "node:path";

/** Resolve DATABASE_URL ("file:./dev.db") to an absolute path. Relative paths resolve from src/db/. */
export function resolveDbPath(): string {
  const raw = process.env.DATABASE_URL || "file:./dev.db";
  const p = raw.replace(/^file:/, "");
  if (path.isAbsolute(p)) return p;
  return path.resolve(process.cwd(), "src/db", p);
}
