"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { Suggestion } from "@/lib/search";
import { FolderIcon, ImageIcon, SearchIcon } from "../win95/Icons";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onPickFilter: (filter: { category?: string }) => void;
};

export type SearchBoxHandle = { focus: () => void };

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  query: "búsqueda",
  tag: "etiqueta",
  title: "meme",
  category: "categoría",
};

/** Search field with debounced autocomplete (combobox pattern). */
export const SearchBox = forwardRef<SearchBoxHandle, Props>(function SearchBox({ value, onChange, onSubmit, onPickFilter }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  useEffect(() => {
    if (!typed.current || value.trim().length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(value)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { items: Suggestion[] };
        setItems(data.items);
        setActive(-1);
        setOpen(document.activeElement === inputRef.current);
      } catch {
        /* aborted or offline */
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  const pick = (s: Suggestion) => {
    setOpen(false);
    typed.current = false;
    if (s.filter) {
      onChange("");
      onPickFilter(s.filter);
    } else {
      onChange(s.label);
      onSubmit(s.label);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && items.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % items.length);
    } else if (e.key === "ArrowUp" && items.length) {
      e.preventDefault();
      setActive((a) => (a <= 0 ? items.length - 1 : a - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && active >= 0 && items[active]) pick(items[active]);
      else {
        setOpen(false);
        onSubmit(value);
      }
    } else if (e.key === "Escape") {
      if (open) {
        e.stopPropagation();
        setOpen(false);
      } else if (value) onChange("");
    }
  };

  return (
    <div className="relative min-w-0 flex-1">
      <div className="relative">
        <span className="pointer-events-none absolute left-1.5 top-1/2 -translate-y-1/2">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Buscar memes"
          className="win-field pl-7 [&::-webkit-search-cancel-button]:hidden"
          placeholder='Probá "reunión que podría ser un email", "lunes" o "boss"'
          value={value}
          autoComplete="off"
          enterKeyHint="search"
          spellCheck={false}
          maxLength={200}
          onChange={(e) => {
            typed.current = true;
            onChange(e.target.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
        />
      </div>
      {open && items.length > 0 && (
        <ul id={listId} role="listbox" className="win-menu left-0 right-0 top-full mt-0.5 max-h-80 overflow-y-auto win-scroll">
          {items.map((s, i) => (
            <li
              key={`${s.kind}:${s.label}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              data-active={i === active}
              className="win-menu-item"
              onPointerDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onPointerEnter={() => setActive(i)}
            >
              {s.filter ? <FolderIcon /> : s.kind === "title" ? <ImageIcon /> : <SearchIcon />}
              <span className="min-w-0 truncate">{s.label}</span>
              <span className="shortcut text-[11px]">{KIND_LABEL[s.kind]}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});
