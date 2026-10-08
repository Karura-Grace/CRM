import { PageHeader } from "@/components/ui";
import ExpenseForm from "../ExpenseForm";
import { createExpense } from "../actions";

export const metadata = { title: "Record expense" };
export default function NewExpensePage() {
  return (<><PageHeader title="Record expense" back={{ href: "/expenses", label: "Expenses" }} /><ExpenseForm action={createExpense} /></>);
}
