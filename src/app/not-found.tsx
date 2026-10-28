import Link from "next/link";
import { ErrorIcon } from "@/components/win95/Icons";
import { Window } from "@/components/win95/Window";

export default function NotFound() {
  return (
    <main id="contenido" className="flex flex-1 items-center justify-center p-3">
      <Window title="Error" controls="close" closeHref="/" className="w-full max-w-md" bodyClassName="p-3">
        <div className="flex gap-3">
          <ErrorIcon />
          <div className="space-y-2">
            <p>
              <b>No se encuentra el archivo.</b>
            </p>
            <p>El meme o la página que buscás no existe, fue movida o se retiró por una solicitud de retirada.</p>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Link href="/" className="win-btn win-btn-default">
            Ir al buscador
          </Link>
          <Link href="/random" className="win-btn">
            Meme al azar
          </Link>
        </div>
      </Window>
    </main>
  );
}
