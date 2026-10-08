import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { surveys } from "@/db/schema";
import { Badge, Empty, PageHeader, TableWrap } from "@/components/ui";
import { fmtDate } from "@/lib/utils";

export const metadata = { title: "Surveys" };

export default async function SurveysPage() {
  const rows = await db.query.surveys.findMany({ with: { questions: { with: { answers: true } } }, orderBy: desc(surveys.id) });
  return (
    <>
      <PageHeader title="Surveys" actions={<Link href="/surveys/create" className="btn-primary">+ New survey</Link>} />
      {rows.length === 0 ? <Empty>No surveys yet.</Empty> : (
        <TableWrap>
          <table className="table">
            <thead><tr><th>Survey</th><th>Questions</th><th>Answers</th><th>Created</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/surveys/${s.id}`} className="font-medium">{s.subject}</Link></td>
                  <td>{s.questions.length}</td>
                  <td>{s.questions.reduce((a, q) => a + q.answers.length, 0)}</td>
                  <td>{fmtDate(s.createdAt)}</td>
                  <td><Badge status={s.active ? "active" : "inactive"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
    </>
  );
}
