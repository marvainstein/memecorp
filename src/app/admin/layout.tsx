import type { Metadata } from "next";
import { GearIcon } from "@/components/win95/Icons";
import { Window } from "@/components/win95/Window";
import { AdminTabs } from "./AdminTabs";

export const metadata: Metadata = { title: "Panel de control", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="contenido" className="flex flex-1 flex-col md:p-3 lg:p-5">
      <Window title="Panel de control de MemeCorp" icon={<GearIcon />} controls="close" closeHref="/" className="mx-auto w-full max-w-[1400px] flex-1" bodyClassName="p-2 sm:p-3">
        <AdminTabs />
        <div className="win-tabpanel min-h-0 flex-1">{children}</div>
      </Window>
    </main>
  );
}
