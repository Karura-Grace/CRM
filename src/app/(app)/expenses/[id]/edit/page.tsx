import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { expenses } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import ExpenseForm from "../../ExpenseForm";
import { updateExpense } from "../../actions";

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const e = await db.query.expenses.findFirst({ where: eq(expenses.id, id) });
  if (!e) notFound();
  return (<><PageHeader title="Edit expense" back={{ href: "/expenses", label: "Expenses" }} /><ExpenseForm action={updateExpense.bind(null, id)} initial={e} /></>);
}
