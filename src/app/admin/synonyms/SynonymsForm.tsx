"use client";

import { useState } from "react";

export function SynonymsForm({ initial }: { initial: string }) {
  const [text, setText] = useState(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    const res = await fetch("/api/admin/synonyms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    setMessage(res?.ok ? `Guardado: ${data.groups} grupos.` : (data?.message ?? "No se pudo guardar."));
  };

  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} className="win-field font-win-mono text-[12px]" rows={24} spellCheck={false} />
      <div className="flex items-center gap-2">
        <button type="button" className="win-btn win-btn-default" onClick={save} disabled={busy}>
          Guardar sinónimos
        </button>
        {message && <span className="win-tooltip">{message}</span>}
      </div>
    </div>
  );
}
