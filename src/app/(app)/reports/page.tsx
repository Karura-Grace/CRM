import Link from "next/link";
import { PageHeader } from "@/components/ui";
import ExportButtons from "@/components/ExportButtons";
import { REPORT_CATEGORIES, REPORTS } from "@/lib/reports";

export const metadata = { title: "Reports" };

export default function ReportsIndex() {
  return (
    <>
      <PageHeader title="Reports" subtitle="Every report can be viewed on screen with charts, or downloaded as Excel, Word or CSV." actions={<Link href="/analytics" className="btn-primary">Open analytics dashboard</Link>} />
      <div className="space-y-8">
        {REPORT_CATEGORIES.map((cat) => (
          <section key={cat}>
            <h2 className="mb-3">{cat}</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {REPORTS.filter((r) => r.category === cat).map((r) => (
                <div key={r.key} className="card flex flex-col gap-3">
                  <div className="flex-1">
                    <Link href={`/reports/${r.key}`} className="font-semibold">{r.title}</Link>
                    <p className="muted mt-1">{r.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/reports/${r.key}`} className="btn-secondary btn-sm">View</Link>
                    {!r.filters.includes("customerRequired") && !r.filters.includes("segment") && <ExportButtons report={r.key} compact />}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
