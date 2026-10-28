"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";

export type MenuEntry =
  | { type: "separator" }
  | {
      label: string;
      /** Underlined access key, e.g. "A" for Archivo. */
      shortcut?: string;
      icon?: ReactNode;
      href?: string;
      onSelect?: () => void;
      disabled?: boolean;
      checked?: boolean;
    };

export type Menu = { label: string; accessKey: string; items: MenuEntry[] };

function Underlined({ label, accessKey }: { label: string; accessKey: string }) {
  const i = label.toLowerCase().indexOf(accessKey.toLowerCase());
  if (i < 0) return <>{label}</>;
  return (
    <>
      {label.slice(0, i)}
      <span className="underline">{label[i]}</span>
      {label.slice(i + 1)}
    </>
  );
}

/** Classic menu bar: click to open, hover to switch while open, Esc / outside click to close, Alt+key to open. */
export function MenuBar({ menus, className = "" }: { menus: Menu[]; className?: string }) {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const idx = menus.findIndex((m) => m.accessKey.toLowerCase() === e.key.toLowerCase());
        if (idx >= 0) {
          e.preventDefault();
          setOpen(idx);
          requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-menu="${idx}"] .win-menu-item`)?.focus());
        }
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menus]);

  const onMenuKey = (e: React.KeyboardEvent, idx: number) => {
    const items = [...(e.currentTarget.querySelectorAll<HTMLElement>(".win-menu-item:not([disabled])") ?? [])];
    const pos = items.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[(pos + 1) % items.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[(pos - 1 + items.length) % items.length]?.focus();
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = (idx + (e.key === "ArrowRight" ? 1 : -1) + menus.length) % menus.length;
      setOpen(next);
      requestAnimationFrame(() => ref.current?.querySelector<HTMLElement>(`[data-menu="${next}"] .win-menu-item`)?.focus());
    }
  };

  return (
    <nav ref={ref} className={`win-menubar relative ${className}`} aria-label="Menú principal">
      {menus.map((menu, idx) => (
        <div key={menu.label} className="relative" data-menu={idx}>
          <button
            type="button"
            className="win-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={open === idx}
            onClick={() => setOpen(open === idx ? null : idx)}
            onPointerEnter={() => open !== null && setOpen(idx)}
          >
            <Underlined label={menu.label} accessKey={menu.accessKey} />
          </button>
          {open === idx && (
            <div role="menu" className="win-menu left-0 top-full" onKeyDown={(e) => onMenuKey(e, idx)}>
              {menu.items.map((item, i) => {
                if ("type" in item) return <div key={i} className="win-separator" role="separator" />;
                const content = (
                  <>
                    <span className="inline-flex w-4 justify-center">{item.checked ? "✓" : item.icon}</span>
                    <span>{item.label}</span>
                    {item.shortcut && <span className="shortcut">{item.shortcut}</span>}
                  </>
                );
                if (item.href) {
                  return (
                    <Link key={i} role="menuitem" href={item.href} className="win-menu-item" onClick={() => setOpen(null)}>
                      {content}
                    </Link>
                  );
                }
                return (
                  <button
                    key={i}
                    type="button"
                    role={item.checked !== undefined ? "menuitemcheckbox" : "menuitem"}
                    aria-checked={item.checked}
                    className="win-menu-item disabled:text-win-dark"
                    disabled={item.disabled}
                    onClick={() => {
                      setOpen(null);
                      item.onSelect?.();
                    }}
                  >
                    {content}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
