"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/memes", label: "Memes" },
  { href: "/admin/reports", label: "Reportes" },
  { href: "/admin/sources", label: "Fuentes" },
  { href: "/admin/synonyms", label: "Sinónimos" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <nav className="win-tabs" role="tablist" aria-label="Secciones del panel">
      {TABS.map((t) => {
        const active = t.href === "/admin" ? pathname === "/admin" : pathname.startsWith(t.href);
        return (
          <Link key={t.href} href={t.href} role="tab" aria-selected={active} className="win-tab">
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
