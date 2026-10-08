/** Daily scheduled job — run with `npm run cron` from the host scheduler (see docs §6). */
import "dotenv/config";
import { runAllJobs } from "../src/lib/jobs";

runAllJobs()
  .then((r) => {
    const stamp = new Date().toISOString();
    console.log(`[${stamp}] invoices marked overdue: ${r.overdueMarked}`);
    console.log(`[${stamp}] recurring invoices: ${r.invoicesGenerated.length ? r.invoicesGenerated.join(", ") : "none"}`);
    console.log(`[${stamp}] contract expiry notices: ${r.expiryNotices.length}`);
    r.expiryNotices.forEach((m) => console.log(`  - ${m}`));
    console.log(`[${stamp}] recurring expenses created: ${r.expensesCreated}`);
    console.log(`[${stamp}] AI prospecting: ${r.prospecting}`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("cron failed:", err);
    process.exit(1);
  });
