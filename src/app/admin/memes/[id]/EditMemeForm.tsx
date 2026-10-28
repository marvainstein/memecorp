"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TaxonomyPicker } from "@/components/forms/TaxonomyPicker";
import { LICENSES } from "@/lib/memes/taxonomy";
import type { Meme } from "@/lib/memes/types";

export function EditMemeForm({ meme }: { meme: Meme }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "saving">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const send = async (method: "PATCH" | "DELETE", body?: unknown) => {
    setState("saving");
    setMessage(null);
    const res = await fetch(`/api/admin/memes/${meme.id}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setState("idle");
    setMessage(res?.ok ? "Cambios guardados." : (data?.message ?? "No se pudo guardar."));
    router.refresh();
  };

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    send("PATCH", {
      title: text("title"),
      description: text("description"),
      altText: text("altText"),
      ocrText: text("ocrText"),
      tags: text("tags"),
      synonyms: text("synonyms"),
      sourceUrl: text("sourceUrl") || null,
      sourceName: text("sourceName") || null,
      credit: text("credit") || null,
      license: text("license"),
      emotions: f.getAll("emotions").map(String),
      categories: f.getAll("categories").map(String),
      languages: f.getAll("languages").map(String),
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block">
        Título
        <input name="title" defaultValue={meme.title} className="win-field mt-1" maxLength={160} required />
      </label>
      <label className="block">
        Descripción
        <textarea name="description" defaultValue={meme.description} className="win-field mt-1" rows={2} maxLength={2000} />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          Etiquetas (coma)
          <input name="tags" defaultValue={meme.tags.join(", ")} className="win-field mt-1" />
        </label>
        <label className="block">
          Sinónimos (coma)
          <input name="synonyms" defaultValue={meme.synonyms.join(", ")} className="win-field mt-1" />
        </label>
      </div>
      <label className="block">
        Texto en la imagen (OCR, editable)
        <textarea name="ocrText" defaultValue={meme.ocrText} className="win-field mt-1" rows={3} maxLength={2000} />
      </label>
      <label className="block">
        Texto alternativo
        <input name="altText" defaultValue={meme.altText} className="win-field mt-1" maxLength={500} />
      </label>
      <TaxonomyPicker name="emotions" defaultValue={meme.emotions} />
      <TaxonomyPicker name="categories" defaultValue={meme.categories} />
      <TaxonomyPicker name="languages" defaultValue={meme.languages} columns="grid-cols-2" />
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          URL de origen
          <input name="sourceUrl" type="url" defaultValue={meme.sourceUrl ?? ""} className="win-field mt-1" />
        </label>
        <label className="block">
          Nombre de la fuente
          <input name="sourceName" defaultValue={meme.sourceName ?? ""} className="win-field mt-1" />
        </label>
        <label className="block">
          Crédito / autor
          <input name="credit" defaultValue={meme.credit ?? ""} className="win-field mt-1" />
        </label>
        <label className="block sm:col-span-2">
          Licencia
          <select name="license" defaultValue={meme.license} className="win-field mt-1">
            {LICENSES.map((l) => (
              <option key={l.slug} value={l.slug}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button type="submit" className="win-btn win-btn-default" disabled={state === "saving"}>
          Guardar cambios
        </button>
        {meme.status !== "active" && meme.status !== "removed" && (
          <button type="button" className="win-btn" onClick={() => send("PATCH", { status: "active", statusReason: null })}>
            Publicar
          </button>
        )}
        {meme.status === "active" && (
          <button type="button" className="win-btn" onClick={() => send("PATCH", { status: "hidden", statusReason: "Oculto por un administrador" })}>
            Ocultar
          </button>
        )}
        {meme.status !== "removed" && (
          <button
            type="button"
            className="win-btn"
            onClick={() => window.confirm("¿Eliminar el archivo definitivamente? Su huella queda bloqueada para futuras importaciones.") && send("DELETE")}
          >
            Eliminar
          </button>
        )}
        {message && <span className="win-tooltip">{message}</span>}
      </div>
    </form>
  );
}
