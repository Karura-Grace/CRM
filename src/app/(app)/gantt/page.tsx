import { redirect } from "next/navigation";

/** Sidebar shortcut: the portfolio Gantt (all projects with their tasks). */
export default function GanttShortcut() {
  redirect("/projects?view=gantt&tasks=1");
}
