import "dotenv/config";
import fs from "node:fs";
import { resolveDbPath } from "../src/db/path";

const p = resolveDbPath();
for (const f of [p, `${p}-wal`, `${p}-shm`]) {
  if (fs.existsSync(f)) { fs.rmSync(f); console.log("removed", f); }
}
