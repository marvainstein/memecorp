import type { Metadata } from "next";
import { FlagIcon } from "@/components/win95/Icons";
import { Window } from "@/components/win95/Window";
import { config } from "@/lib/config";
import { TakedownForm } from "./TakedownForm";

export const metadata: Metadata = {
  title: "Aviso y retirada (DMCA)",
  description: "Cómo solicitar la retirada de un meme alojado en MemeCorp.",
};

export default function TakedownPage() {
  return (
    <main id="contenido" className="flex flex-1 flex-col items-center md:p-4 lg:p-6">
      <Window title="Aviso y retirada de contenido" icon={<FlagIcon />} controls="close" closeHref="/" className="w-full max-w-3xl" bodyClassName="p-3 space-y-3">
        <section className="space-y-2">
          <p>
            MemeCorp es un buscador gratuito que indexa automáticamente memes publicados en fuentes públicas, con fines de humor, parodia, crítica
            y comentario. Cada meme guarda un enlace a su publicación de origen. Respetamos los derechos de autor y la privacidad, y actuamos rápido ante cualquier reclamo.
          </p>
          <fieldset className="win-groupbox space-y-1.5">
            <legend>Cómo funciona</legend>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                Usá el botón <b>Reportar</b> en la ficha del meme o completá el formulario de abajo con el enlace.
              </li>
              <li>
                Cada reporte queda registrado y visible para los administradores.
                {config.reportAutohideThreshold > 0 && (
                  <> Si un meme acumula {config.reportAutohideThreshold} reportes abiertos, se oculta automáticamente hasta su revisión.</>
                )}
              </li>
              <li>
                Un administrador puede <b>ocultar</b> el meme al instante (deja de verse y su imagen deja de servirse) o <b>eliminarlo</b> (se borra
                el archivo y su huella digital impide que se vuelva a subir).
              </li>
              <li>Si el reclamo no procede, el meme vuelve a publicarse y el reporte se cierra.</li>
            </ol>
          </fieldset>
          <fieldset className="win-groupbox space-y-1">
            <legend>Para reclamos de derechos de autor, incluí</legend>
            <ul className="list-disc space-y-1 pl-5">
              <li>El enlace del meme en MemeCorp.</li>
              <li>Una descripción de la obra original y dónde está publicada.</li>
              <li>Tu nombre y un email de contacto.</li>
              <li>Una declaración de buena fe de que sos titular de los derechos o actuás en su nombre.</li>
            </ul>
          </fieldset>
        </section>
        <fieldset className="win-groupbox">
          <legend>Solicitud de retirada</legend>
          <TakedownForm />
        </fieldset>
      </Window>
    </main>
  );
}
