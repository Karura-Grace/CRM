import { deliveryReports, operationsReports, pipelineReports } from "./delivery";
import { listReports } from "./lists";
import { salesReports } from "./sales";
import type { ReportDef } from "./types";

/** The report registry. Add a report by appending a ReportDef to one of these arrays. */
export const REPORTS: ReportDef[] = [...salesReports, ...pipelineReports, ...deliveryReports, ...operationsReports, ...listReports];
export const getReport = (key: string) => REPORTS.find((r) => r.key === key);
export const REPORT_CATEGORIES = ["Sales & finance", "Pipeline", "Delivery", "Operations", "Lists & exports"] as const;
export type { ReportDef, ReportResult, Col, ChartSpec, Params } from "./types";
