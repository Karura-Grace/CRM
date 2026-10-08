import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { items } from "@/db/schema";
import { PageHeader } from "@/components/ui";
import ItemForm from "../../ItemForm";
import { updateItem } from "../../actions";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  const item = await db.query.items.findFirst({ where: eq(items.id, id) });
  if (!item) notFound();
  return (<><PageHeader title="Edit item" back={{ href: "/items", label: "Items" }} /><ItemForm action={updateItem.bind(null, id)} initial={item} /></>);
}
