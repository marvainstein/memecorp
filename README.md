# MemeDesk

Buscador universal y gratuito de **memes corporativos estáticos**, con estética Windows 95/98. Escribís una palabra, una frase o una situación
(“reunión que podría haber sido un email”, “boss”, “cansado”) y obtenés memes listos para descargar o compartir. El catálogo se llena solo
mediante importadores automáticos.

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4** con un sistema de diseño Win95 propio (`src/app/globals.css`).
- **PostgreSQL** con Full Text Search (español, inglés y `simple`) + **pg_trgm** para tolerancia a errores + **unaccent**.
  En desarrollo usa **PGlite** (Postgres embebido); en producción cualquier Postgres 14+ vía `DATABASE_URL`.
- Almacenamiento **local** o **S3-compatible** (S3, R2, B2, MinIO).
- **Importación automática** programada con adaptadores, throttling por servidor, reintentos, robots.txt y OCR.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local      # definí al menos ADMIN_PASSWORD
npm run dev
```

Abrí http://localhost:3000. Unos segundos después de iniciar, el planificador corre las fuentes configuradas y el catálogo empieza a crecer
solo. El panel está en `/admin` (usuario y contraseña de `ADMIN_USER` / `ADMIN_PASSWORD`).

> Con PGlite solo un proceso puede abrir la base: detené `npm run dev` antes de usar `npm run import`.

## Cómo se puebla el catálogo

Cada **fuente** (`import_sources`) usa un **adaptador** (`src/lib/importers/adapters`) y corre cada N minutos:

| Fuente por defecto | Adaptador | Necesita |
| --- | --- | --- |
| Imgflip — plantillas de reacción | API pública de Imgflip | nada |
| Imgflip — plantillas de series de oficina | Búsqueda pública de plantillas de Imgflip, por serie y personaje | nada |
| Lemmy — humor laboral | API abierta de Lemmy (comunidades + búsquedas) | nada |
| Lemmy — fans de series de oficina | Comunidades de fans (`dundermifflin`, `severance`, `itcrowd`) | nada |
| Reddit — humor corporativo | **API oficial** de Reddit (OAuth, app tipo *script*) | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` |
| Pinterest — tableros | **API oficial v5** de Pinterest | `PINTEREST_ACCESS_TOKEN` + IDs de tableros |
| Feeds RSS / Atom | Cheerio (XML) | URLs de feeds |
| Páginas web permitidas | Cheerio (HTML) | URLs de páginas cuyo robots.txt lo permita |

Las fuentes sin credenciales se **omiten** (no cuentan como fallo) y el panel indica qué falta. Desde `/admin/sources` se activan, se editan
(JSON), se cambia su intervalo y se ejecutan a mano; el historial muestra cada corrida.

El catálogo solo tiene memes reales publicados en esas fuentes; MemeDesk no genera imágenes. Las series y películas de oficina que la
gente busca por nombre (*The Office*, *Parks and Recreation*, Nathan Fielder, *Office Space*, *Severance*, *Silicon Valley*,
*The IT Crowd*, *Succession*, *Brooklyn Nine-Nine*, *Superstore*, *Mad Men*) están en `src/lib/memes/franchises.ts`: de ahí salen
las búsquedas de plantillas, los sinónimos (“parks and rec” = “parks and recreation”) y el etiquetado automático por personajes y
frases detectados en el título, el texto o el OCR. Para sumar una serie, agregala a esa lista.

**Pipeline por candidato:** ya visto (por ID de origen o URL) → descarte · lista de bloqueo de contenido → descarte · descarga con límite de
tamaño · solo imágenes estáticas ≥ 200 px · **OCR** del texto impreso (tesseract.js, español + inglés, local) · filtro de temática laboral
(si la fuente no es temática por definición) · auto-etiquetado (etiquetas, categorías, series, idioma) · deduplicación por **SHA-256** y
**hash perceptual de 256 bits** · miniatura WebP · guardado en storage + base.

**Resiliencia:**

- `PoliteHttp` (`src/lib/importers/http.ts`): intervalo mínimo por host, `robots.txt` (Allow/Disallow y Crawl-delay para páginas),
  timeouts, tope de bytes y reintentos con backoff exponencial + jitter que respetan `Retry-After` (429/5xx).
- Circuit breaker por fuente: tras 3 fallos seguidos se pausa 15 min, y la pausa se duplica hasta 24 h. Un error en una imagen no tumba la
  corrida.
- Lock en base de datos por fuente (sirve con varios procesos); las corridas interrumpidas se cierran solas.
- El buscador lee solo de la base propia: si una fuente cae, todo lo indexado sigue disponible.

> MemeDesk no evade bloqueos (sin proxies rotativos ni navegadores camuflados) y no rastrea sitios cuyos términos o robots.txt lo prohíben.
> Por eso Pinterest y Reddit van por sus APIs oficiales.

### Formas de ejecutar el planificador

- **En el servidor web** (por defecto, `IMPORT_SCHEDULER=inprocess`): arranca con `npm run dev` / `npm start` vía `src/instrumentation.ts`.
- **Worker aparte** (`IMPORT_SCHEDULER=off` en la web + `npm run worker`): requiere `DATABASE_URL`.
- **Cron externo**: `GET /api/cron/import` con `Authorization: Bearer $CRON_SECRET` (por ejemplo Vercel Cron cada 15 min).
- **Consola**: `npm run import` (lo pendiente), `npm run import -- --all`, `npm run import -- lemmy-work-humor`, `npm run import -- --list`.

## Búsqueda

`src/lib/search`: la consulta se normaliza (minúsculas, sin acentos), se agrupan frases de sinónimos (“home office”), se descartan stopwords
y cada término se expande con sus **sinónimos bilingües** (editables en `/admin/synonyms`). Se buscan prefijos en tres configuraciones de
FTS (con stemming en español e inglés) **o** similitud de trigramas (errores de tipeo: “reunon”). El ranking combina `ts_rank_cd`, similitud,
coincidencia en el título y popularidad. Si ninguna coincidencia tiene todas las palabras, se relaja a “alguna”. Autocompletado desde
etiquetas, títulos, búsquedas frecuentes y categorías.

## Moderación y retirada

Cada meme guarda su URL de origen. El botón **Reportar** (y `/aviso-y-retirada`) registra reportes; con
`REPORT_AUTOHIDE_THRESHOLD` reportes abiertos el meme se oculta solo. Desde `/admin/reports` o `/admin/memes` se puede **ocultar** (la
imagen deja de servirse al instante) o **eliminar** (se borran los archivos y la huella queda bloqueada para que no se vuelva a importar).

## Estructura

```
src/app            páginas (/, /search, /m/[id], /aviso-y-retirada, /admin/*) y rutas API
src/components     win95/ (ventanas, menús, diálogos, barra de tareas) y explorer/ (buscador, grilla, ficha)
src/lib/db         conexión (pg / PGlite) y migraciones
src/lib/search     parser de consultas, sinónimos, búsqueda y sugerencias
src/lib/memes      modelo, repositorio, ingesta (hashes, miniaturas) y reportes
src/lib/importers  adaptadores, cliente HTTP prudente, OCR, auto-etiquetado, runner y planificador
src/lib/storage    drivers local y S3
scripts/           import, worker
```
