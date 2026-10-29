import type { Metadata, Viewport } from "next";
import { Taskbar } from "@/components/win95/Taskbar";
import "./globals.css";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "MemeDesk — buscador de memes corporativos", template: "%s · MemeDesk" },
  description:
    "Buscador gratuito de memes corporativos y de humor laboral en español e inglés. Encontrá, descargá y compartí el meme justo en segundos.",
  applicationName: "MemeDesk",
  openGraph: { siteName: "MemeDesk", type: "website", locale: "es_AR" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#008080",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-dvh">
        <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 win-btn">
          Saltar al contenido
        </a>
        <div className="flex min-h-dvh flex-col pb-9">{children}</div>
        <Taskbar />
      </body>
    </html>
  );
}
