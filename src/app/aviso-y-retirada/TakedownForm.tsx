"use client";

import { useState } from "react";
import { InfoIcon, WarningIcon } from "@/components/win95/Icons";
import { REPORT_REASONS } from "@/lib/memes/taxonomy";

export function TakedownForm() {
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setState("sending");
    setMessage(null);
    const res = await fetch("/api/takedown", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, isRightsHolder: data.isRightsHolder === "on" }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) {
      setState("done");
      setMessage(`Solicitud recibida (n.º ${body.id}). Guardá este número para cualquier consulta.`);
    } else {
      setState("idle");
      setMessage(body?.message ?? "No se pudo enviar la solicitud.");
    }
  };

  if (state === "done") {
    return (
      <div className="flex gap-3">
        <InfoIcon />
        <p>{message}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label className="block">
        Enlace del meme en MemeCorp *
        <input name="targetUrl" type="url" required className="win-field mt-1" placeholder="https://…/m/abc123" maxLength={2000} />
      </label>
      <label className="block">
        Motivo *
        <select name="reason" className="win-field mt-1" defaultValue="copyright">
          {REPORT_REASONS.map((r) => (
            <option key={r.slug} value={r.slug}>
              {r.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        Descripción de la obra y del reclamo *
        <textarea name="details" required minLength={10} className="win-field mt-1" rows={4} maxLength={5000} placeholder="Qué obra es, dónde está publicada la original y por qué te pertenece." />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          Nombre completo *
          <input name="reporterName" required className="win-field mt-1" maxLength={160} />
        </label>
        <label className="block">
          Email de contacto *
          <input name="reporterEmail" type="email" required className="win-field mt-1" maxLength={200} />
        </label>
      </div>
      <label className="flex items-start gap-2">
        <input type="checkbox" name="isRightsHolder" className="win-check mt-0.5" required />
        Declaro de buena fe que soy titular de los derechos (o estoy autorizado a actuar en su nombre) y que la información de esta solicitud es
        exacta.
      </label>
      {message && (
        <div className="flex items-center gap-2">
          <WarningIcon size={20} /> {message}
        </div>
      )}
      <div className="flex justify-end">
        <button type="submit" className="win-btn win-btn-default" disabled={state === "sending"}>
          {state === "sending" ? "Enviando…" : "Enviar solicitud de retirada"}
        </button>
      </div>
    </form>
  );
}
