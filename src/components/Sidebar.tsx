"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = { href: string; label: string; icon: string; adminOnly?: boolean };
type NavSection = { title?: string; items: NavItem[] };

/** Add new modules here (and to ADMIN_ONLY_PREFIXES in proxy.ts if admin-only). */
export const NAV: NavSection[] = [
  { items: [{ href: "/dashboard", label: "Dashboard", icon: "▦" }, { href: "/reminders", label: "Reminders", icon: "⏰" }, { href: "/search", label: "Search", icon: "⌕" }] },
  {
    title: "Insights",
    items: [
      { href: "/analytics", label: "Analytics", icon: "◔" },
      { href: "/reports", label: "Reports & exports", icon: "⇩" },
    ],
  },
  {
    title: "Clients",
    items: [
      { href: "/customers", label: "Customers", icon: "◉" },
      { href: "/leads", label: "Leads", icon: "◎" },
      { href: "/prospecting", label: "AI prospecting", icon: "✦" },
      { href: "/segments", label: "Segments", icon: "⊂" },
    ],
  },
  {
    title: "Sales",
    items: [
      { href: "/proposals", label: "Proposals", icon: "✎" },
      { href: "/estimates", label: "Estimates", icon: "≋" },
      { href: "/invoices", label: "Invoices", icon: "▤" },
      { href: "/payments", label: "Payments", icon: "◈" },
      { href: "/items", label: "Items", icon: "▫" },
    ],
  },
  {
    title: "Delivery",
    items: [
      { href: "/projects", label: "Projects", icon: "◫" },
      { href: "/tasks", label: "Tasks", icon: "☑" },
      { href: "/gantt", label: "Gantt schedule", icon: "▭" },
      { href: "/timesheets", label: "Timesheets", icon: "◷" },
      { href: "/tickets", label: "Support", icon: "✉" },
      { href: "/contracts", label: "Contracts", icon: "§" },
      { href: "/expenses", label: "Expenses", icon: "−" },
    ],
  },
  {
    title: "Resources",
    items: [
      { href: "/knowledge-base", label: "Knowledge Base", icon: "?" },
      { href: "/surveys", label: "Surveys", icon: "☰" },
    ],
  },
  {
    title: "Admin",
    items: [
      { href: "/staff", label: "Staff", icon: "☺", adminOnly: true },
      { href: "/settings", label: "Settings", icon: "⚙", adminOnly: true },
    ],
  },
];

export default function Sidebar({ role, companyName }: { role: "admin" | "staff"; companyName: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="flex flex-col gap-4 px-3 py-4">
      {NAV.map((section, i) => {
        const items = section.items.filter((it) => !it.adminOnly || role === "admin");
        if (items.length === 0) return null;
        return (
          <div key={i}>
            {section.title && (
              <div className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-brand-300">{section.title}</div>
            )}
            <ul className="flex flex-col gap-0.5">
              {items.map((it) => {
                const active = pathname === it.href || pathname.startsWith(`${it.href}/`);
                return (
                  <li key={it.href}>
                    <Link
                      href={it.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
                        active ? "bg-brand-700 text-white" : "text-brand-100 hover:bg-brand-800 hover:text-white"
                      }`}
                    >
                      <span className="w-4 text-center opacity-80">{it.icon}</span>
                      {it.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  return (
    <>
      <div className="no-print flex items-center justify-between bg-brand-950 px-4 py-3 text-white lg:hidden">
        <span className="font-semibold">{companyName}</span>
        <button type="button" className="rounded px-2 py-1 text-white hover:bg-brand-800" onClick={() => setOpen((o) => !o)} aria-label="Menu">
          ☰
        </button>
      </div>
      {open && <div className="no-print bg-brand-950 lg:hidden">{nav}</div>}
      <aside className="no-print hidden w-60 shrink-0 bg-brand-950 lg:block">
        <div className="sticky top-0 max-h-screen overflow-y-auto">
          <div className="border-b border-brand-900 px-5 py-4">
            <div className="text-lg font-bold text-white">{companyName}</div>
            <div className="text-xs text-brand-300">CRM</div>
          </div>
          {nav}
        </div>
      </aside>
    </>
  );
}
