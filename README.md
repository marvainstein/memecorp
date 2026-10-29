# MemeCorp

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
| Imgflip — plantillas por tema | Búsqueda pública de plantillas de Imgflip por tema de oficina (reuniones, jefes, lunes, sueldo…) | nada |
| Lemmy — humor laboral | API abierta de Lemmy (comunidades + búsquedas) | nada |
| Lemmy — fans de series de oficina | Comunidades de fans (`dundermifflin`, `severance`, `itcrowd`) + búsquedas por serie en comunidades de memes | nada |
| Lemmy — memes en español | Búsquedas en español (“chamba”, “jefe”, “quincena”…) en Neo Mujico (`mujico.org`), la comunidad de memes en español más grande de Lemmy | nada |
| Reddit — humor corporativo | **API oficial** de Reddit (OAuth, app tipo *script*) | `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` |
| Pinterest — tableros | **API oficial v5** de Pinterest | `PINTEREST_ACCESS_TOKEN` + IDs de tableros |
| Feeds RSS / Atom | Cheerio (XML) | URLs de feeds |
| Páginas web permitidas | Cheerio (HTML) | URLs de páginas cuyo robots.txt lo permita |

Las fuentes sin credenciales se **omiten** (no cuentan como fallo) y el panel indica qué falta. Desde `/admin/sources` se activan, se editan
(JSON), se cambia su intervalo y se ejecutan a mano; el historial muestra cada corrida.

El catálogo solo tiene memes reales publicados en esas fuentes; MemeCorp no genera imágenes. Las series y películas de oficina que la
gente busca por nombre (*The Office*, *Parks and Recreation*, Nathan Fielder, *Office Space*, *Severance*, *Silicon Valley*,
*The IT Crowd*, *Succession*, *Brooklyn Nine-Nine*, *Superstore*, *Mad Men*) están en `src/lib/memes/franchises.ts`: de ahí salen
las búsquedas de plantillas, los sinónimos (“parks and rec” = “parks and recreation”) y el etiquetado automático por personajes y
frases detectados en el título, el texto o el OCR (solo términos inequívocos: “Lumbergh” sí, “office space” no). Las búsquedas
en Lemmy solo cuentan resultados de comunidades de memes, así no entran noticias ni hilos de discusión. Para sumar una serie,
agregala a esa lista.

Las búsquedas por tema (`src/lib/memes/topics.ts`) traen las plantillas clásicas de cada categoría (“Boardroom Meeting Suggestion”,
“Case Of The Mondays”, “As Per My Last Email”) y les asignan esa categoría; solo se toman las que nombran el tema y no aparecen en
la lista de exclusiones (juegos, política, noticias). Además, el auto-etiquetado agrega categorías temáticas por palabras clave
(`CATEGORY_RULES` en `src/lib/importers/autotag.ts`) a los memes que solo tienen categorías genéricas. `npm run import -- --list`
muestra qué busca cada fuente.

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

> MemeCorp no evade bloqueos (sin proxies rotativos ni navegadores camuflados) y no rastrea sitios cuyos términos o robots.txt lo prohíben.
> Por eso Pinterest y Reddit van por sus APIs oficiales.

### Formas de ejecutar el planificador

- **En el servidor web** (por defecto, `IMPORT_SCHEDULER=inprocess`): arranca con `npm run dev` / `npm start` vía `src/instrumentation.ts`.
- **Worker aparte** (`IMPORT_SCHEDULER=off` en la web + `npm run worker`): requiere `DATABASE_URL`.
- **Cron externo**: `GET /api/cron/import` con `Authorization: Bearer $CRON_SECRET` (cron-job.org, Vercel Cron…). Cada llamada
  importa durante 4 minutos como máximo.
- **GitHub Actions** (`.github/workflows/import.yml`): corre `npm run import` cada 3 horas contra la base y el bucket de producción. Es lo
  que usa el despliegue en Vercel.
- **Consola**: `npm run import` (lo pendiente), `npm run import -- --all`, `npm run import -- lemmy-work-humor`, `npm run import -- --list`.

## Publicar gratis: Vercel + Neon + Cloudflare R2

La web corre en Vercel, la base en Neon (Postgres) y las imágenes en R2. Las importaciones no corren en Vercel (cada función se corta a
los 5 minutos y una ronda completa tarda más), sino en GitHub Actions.

1. **Neon** (neon.tech): creá un proyecto en la región AWS US East (la misma que Vercel usa por defecto) y copiá la *connection string*.
2. **Cloudflare R2**: creá un bucket (p. ej. `memecorp`) y un token de API con permiso *Object Read & Write*. Anotá el Access Key ID,
   el Secret y el endpoint `https://<account-id>.r2.cloudflarestorage.com`. R2 pide una tarjeta aunque el uso entre en el plan gratis;
   Backblaze B2 es una alternativa compatible con S3 que no la pide.
3. **Copiar el catálogo local**: frená `npm run dev`, creá `.env.cloud.local` (no se sube al repo) y corré `npm run migrate:cloud`.
   No lo llames `.env.production.local`: Next.js carga ese archivo en `npm run build`/`npm start`, y la copia local
   pasaría a usar (y migrar) la base de producción.
   Sube las imágenes que falten y copia la base; se puede repetir sin duplicar nada (`-- --replace` pisa una base con datos).
   ```
   DATABASE_URL=postgresql://…neon.tech/neondb?sslmode=require
   STORAGE_DRIVER=s3
   S3_BUCKET=memecorp
   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   S3_ACCESS_KEY_ID=…
   S3_SECRET_ACCESS_KEY=…
   ```
4. **Vercel**: importá el repositorio desde GitHub y cargá en *Environment Variables* las mismas variables, más `S3_REGION=auto`,
   `DATABASE_POOL_SIZE=3`, `ADMIN_USER` y un `ADMIN_PASSWORD` fuerte. En Vercel la app no arranca el planificador y guarda los
   archivos temporales del OCR en `/tmp` sola.
5. **GitHub Actions**: en *Settings → Secrets and variables → Actions → Secrets* creá un secret `REPOSECRETS` y pegá adentro el
   contenido de `.env.cloud.local` (las líneas `KEY=VALUE`). También vale un secret por variable (`DATABASE_URL`, `S3_BUCKET`,
   `S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, y las claves de Reddit/Pinterest si las tenés). GitHub no
   vuelve a mostrar el valor de un secret: al editarlo aparece vacío aunque esté guardado. Para probarlo, ejecutá el workflow
   *Importar memes* con *Run workflow* desde la pestaña *Actions*.

Límites del plan gratis: Vercel no acepta requests de más de 4,5 MB, así que las subidas manuales grandes desde el panel hay que hacerlas
de a una imagen; en repositorios públicos, GitHub pausa los workflows programados tras 60 días sin actividad en el repo.

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
