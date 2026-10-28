"use client";

import Link from "next/link";
import { useState } from "react";
import { Dialog } from "../win95/Dialog";
import { REPORT_REASONS } from "@/lib/memes/taxonomy";
import { FlagIcon, InfoIcon, WarningIcon } from "../win95/Icons";

type Props = { memeId: string; memeTitle: string; open: boolean; onClose: () => void };

export function ReportDialog({ memeId, memeTitle, open, onClose }: Props) {
  const [reason, setReason] = useState("offensive");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const close = () => {
    onClose();
    setTimeout(() => {
      setState("idle");
      setMessage(null);
    }, 200);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setState("sending");
    setMessage(null);
    const res = await fetch(`/api/memes/${memeId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, isRightsHolder: data.isRightsHolder === "on" }),
    }).catch(() => null);
    const body = await res?.json().catch(() => null);
    if (res?.ok) {
      setState("done");
      setMessage(body?.autoHidden ? "Gracias. El meme quedó oculto mientras lo revisamos." : "Gracias. Un administrador revisará el reporte.");
    } else {
      setState("idle");
      setMessage(body?.message ?? "No se pudo enviar el reporte. Probá de nuevo.");
    }
  };

  return (
    <Dialog open={open} onClose={close} title="Reportar contenido" icon={<FlagIcon />} size="max-w-lg">
      {state === "done" ? (
        <div className="space-y-3">
          <div className="flex gap-3">
            <InfoIcon />
            <p>{message}</p>
          </div>
          <div className="flex justify-end">
            <button type="button" className="win-btn win-btn-default" onClick={close} data-autofocus>
              Aceptar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p>
            Vas a reportar <b>“{memeTitle}”</b>. Si sos titular de derechos, también podés leer el{" "}
            <Link href="/aviso-y-retirada">procedimiento de aviso y retirada</Link>.
          </p>
          <fieldset className="win-groupbox space-y-1.5">
            <legend>Motivo</legend>
            {REPORT_REASONS.map((r) => (
              <label key={r.slug} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="reason" value={r.slug} className="win-radio" checked={reason === r.slug} onChange={() => setReason(r.slug)} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <label className="block">
            Detalles {reason === "copyright" ? "(obra original, enlace y por qué es tuya) *" : "(opcional)"}
            <textarea name="details" className="win-field mt-1" rows={3} maxLength={5000} required={reason === "copyright"} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              Nombre {reason === "copyright" ? "*" : "(opcional)"}
              <input name="reporterName" className="win-field mt-1" maxLength={160} required={reason === "copyright"} />
            </label>
            <label className="block">
              Email {reason === "copyright" ? "*" : "(opcional)"}
              <input name="reporterEmail" type="email" className="win-field mt-1" maxLength={200} required={reason === "copyright"} />
            </label>
          </div>
          {reason === "copyright" && (
            <label className="flex items-start gap-2">
              <input type="checkbox" name="isRightsHolder" className="win-check mt-0.5" required />
              Declaro de buena fe que soy titular de los derechos o estoy autorizado a actuar en su nombre, y que la información es correcta.
            </label>
          )}
          {message && (
            <div className="flex items-center gap-2">
              <WarningIcon size={20} />
              <span>{message}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="submit" className="win-btn win-btn-default" disabled={state === "sending"}>
              {state === "sending" ? "Enviando…" : "Enviar reporte"}
            </button>
            <button type="button" className="win-btn" onClick={close}>
              Cancelar
            </button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
