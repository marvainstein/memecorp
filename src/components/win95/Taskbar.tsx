"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { DiceIcon, FlagIcon, GearIcon, HelpIcon, InfoIcon, LogoIcon, SearchIcon } from "./Icons";

export const ABOUT_EVENT = "memedesk:about";
export const openAbout = () => window.dispatchEvent(new Event(ABOUT_EVENT));

function Clock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time className="win-status-cell min-w-[64px] text-center" suppressHydrationWarning>
      {now ? now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
    </time>
  );
}

const START_ITEMS = [
  { href: "/", label: "Buscar memes", icon: <SearchIcon size={24} /> },
  { href: "/random", label: "Meme al azar", icon: <DiceIcon size={24} /> },
  { href: "/aviso-y-retirada", label: "Aviso y retirada", icon: <FlagIcon size={24} /> },
  { href: "/admin", label: "Panel de control", icon: <GearIcon size={24} /> },
];

export function Taskbar() {
  const [startOpen, setStartOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setStartOpen(false), [pathname]);

  useEffect(() => {
    const onAbout = () => setAboutOpen(true);
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setStartOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setStartOpen(false);
    window.addEventListener(ABOUT_EVENT, onAbout);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(ABOUT_EVENT, onAbout);
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const section = pathname.startsWith("/admin") ? "Panel de control" : pathname.startsWith("/m/") ? "Ficha del meme" : "MemeDesk";

  return (
    <>
      <div ref={ref} className="fixed inset-x-0 bottom-0 z-40 flex h-9 items-center gap-1 bg-win-gray px-1 shadow-[inset_0_1px_#dfdfdf,inset_0_2px_#fff]">
        <button
          type="button"
          className="win-btn win-btn-sm h-[28px] min-w-0 gap-1 px-2 font-bold"
          aria-pressed={startOpen}
          aria-haspopup="menu"
          aria-expanded={startOpen}
          onClick={() => setStartOpen((o) => !o)}
        >
          <LogoIcon />
          Inicio
        </button>
        <div className="win-vseparator" />
        <Link href="/" className="win-btn win-btn-sm h-[28px] min-w-0 max-w-[45vw] justify-start gap-1 overflow-hidden px-2 sm:max-w-[200px]" aria-pressed="true">
          <LogoIcon />
          <span className="truncate">{section}</span>
        </Link>
        <div className="ml-auto flex items-center">
          <Clock />
        </div>

        {startOpen && (
          <div role="menu" className="win-menu bottom-[34px] left-0.5 flex w-[min(260px,calc(100vw-8px))] p-[3px]">
            <div className="flex w-7 items-end justify-center bg-gradient-to-t from-win-navy to-win-blue pb-2">
              <span className="whitespace-nowrap text-[18px] font-bold text-white [writing-mode:vertical-rl] rotate-180">
                Meme<span className="font-normal">Desk 98</span>
              </span>
            </div>
            <div className="flex-1 py-0.5">
              {START_ITEMS.map((item) => (
                <Link key={item.href} href={item.href} role="menuitem" className="win-menu-item py-2" onClick={() => setStartOpen(false)}>
                  {item.icon}
                  {item.label}
                </Link>
              ))}
              <div className="win-separator" />
              <button
                type="button"
                role="menuitem"
                className="win-menu-item py-2"
                onClick={() => {
                  setStartOpen(false);
                  setAboutOpen(true);
                }}
              >
                <HelpIcon size={24} />
                Acerca de MemeDesk
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={aboutOpen} onClose={() => setAboutOpen(false)} title="Acerca de MemeDesk" icon={<HelpIcon />}>
        <div className="flex gap-3">
          <InfoIcon />
          <div className="space-y-2">
            <p>
              <b>MemeDesk 98</b> — el buscador universal de memes corporativos estáticos.
            </p>
            <p>Gratis, sin cuentas, sin límites. Buscá por palabras, frases, situaciones o series, en español o inglés.</p>
            <p>
              El catálogo se indexa automáticamente desde fuentes públicas y se mantiene bajo el marco de parodia y uso legítimo. Cada meme
              conserva un enlace a su origen. Si sos titular de derechos sobre una imagen, usá el <Link href="/aviso-y-retirada">procedimiento de aviso y retirada</Link>.
            </p>
            <p className="text-win-dark">Inspirado en las interfaces de escritorio de los 90. Sin afiliación con ningún fabricante de software.</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" className="win-btn win-btn-default" onClick={() => setAboutOpen(false)} data-autofocus>
            Aceptar
          </button>
        </div>
      </Dialog>
    </>
  );
}
