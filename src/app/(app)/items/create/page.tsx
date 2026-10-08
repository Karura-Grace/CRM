import { PageHeader } from "@/components/ui";
import ItemForm from "../ItemForm";
import { createItem } from "../actions";

export const metadata = { title: "New item" };
export default function NewItemPage() {
  return (<><PageHeader title="New item" back={{ href: "/items", label: "Items" }} /><ItemForm action={createItem} /></>);
}
