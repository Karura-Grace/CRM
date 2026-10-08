import { notFound } from "next/navigation";
import ExportButtons from "@/components/ExportButtons";
import PrintButton from "@/components/PrintButton";
import ReportFilters from "@/components/ReportFilters";
import ReportView from "@/components/ReportView";
import { PageHeader } from "@/components/ui";
import { getReport } from "@/lib/reports";

export default async function ReportPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<Record<string, string>> }) {
  const { key } = await params;
  const sp = await searchParams;
  const report = getReport(key);
  if (!report) notFound();
  const result = await report.run(sp);
  return (
    <>
      <PageHeader title={result.title} subtitle={result.subtitle} back={{ href: "/reports", label: "Reports" }} actions={<><ExportButtons report={key} params={sp} /><PrintButton /></>} />
      <ReportFilters report={report} params={sp} action={`/reports/${key}`} />
      <ReportView result={result} />
    </>
  );
}
