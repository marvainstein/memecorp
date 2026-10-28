/**
 * Fixed taxonomies. Slugs are what gets stored in the database; labels and keywords
 * are folded into each meme's search document so "jefe" finds memes in `jefes`.
 */
export type TaxonomyItem = { slug: string; en: string; es: string; keywords: string[] };

export const CATEGORIES: TaxonomyItem[] = [
  { slug: "reuniones", en: "Meetings", es: "Reuniones", keywords: ["meeting", "junta", "call", "llamada", "podria haber sido un email"] },
  { slug: "jefes", en: "Bosses & managers", es: "Jefes y managers", keywords: ["jefe", "boss", "manager", "gerente", "supervisor", "ceo"] },
  { slug: "burnout", en: "Burnout & stress", es: "Burnout y estrés", keywords: ["estres", "agotamiento", "cansancio", "deadline"] },
  { slug: "salario", en: "Salary & money", es: "Sueldo y plata", keywords: ["sueldo", "salario", "aumento", "raise", "paycheck", "plata", "dinero"] },
  { slug: "renuncias", en: "Quitting", es: "Renuncias", keywords: ["renuncia", "renunciar", "quit", "resign", "despido", "fired"] },
  { slug: "vacaciones", en: "Vacation", es: "Vacaciones", keywords: ["vacaciones", "vacation", "feriado", "holiday", "pto", "licencia"] },
  { slug: "lunes", en: "Mondays & Fridays", es: "Lunes y viernes", keywords: ["lunes", "monday", "viernes", "friday", "semana"] },
  { slug: "remoto", en: "Remote work", es: "Trabajo remoto", keywords: ["home office", "remoto", "videollamada", "zoom", "teams", "camara", "mute"] },
  { slug: "companeros", en: "Coworkers", es: "Compañeros", keywords: ["coworker", "colega", "companero", "equipo", "team"] },
  { slug: "rrhh", en: "HR", es: "Recursos humanos", keywords: ["rrhh", "hr", "recursos humanos", "onboarding", "entrevista", "interview"] },
  { slug: "excel-oficina", en: "Excel & office tools", es: "Excel y oficina", keywords: ["excel", "planilla", "spreadsheet", "powerpoint", "email", "correo", "impresora"] },
  { slug: "programacion", en: "Programming & IT", es: "Programación y sistemas", keywords: ["codigo", "code", "bug", "deploy", "developer", "programador", "it", "sistemas"] },
  { slug: "clientes", en: "Clients", es: "Clientes", keywords: ["cliente", "client", "customer", "feedback", "cambios"] },
  { slug: "presentaciones", en: "Presentations", es: "Presentaciones", keywords: ["presentacion", "slides", "diapositivas", "pitch", "deck", "powerpoint"] },
  { slug: "reacciones", en: "Reactions", es: "Reacciones", keywords: ["reaccion", "reaction", "cara", "face", "expresion"] },
  { slug: "series-peliculas", en: "TV & movies", es: "Series y películas", keywords: ["serie", "series", "pelicula", "peliculas", "movie", "sitcom", "tv"] },
  { slug: "wholesome", en: "Wholesome", es: "Wholesome", keywords: ["tierno", "lindo", "wholesome", "positivo", "buena onda"] },
  { slug: "absurdo", en: "Absurd", es: "Absurdo", keywords: ["absurdo", "random", "sin sentido", "surreal", "weird"] },
];

export const FORMATS = [
  { slug: "jpg", label: "JPG" },
  { slug: "png", label: "PNG" },
  { slug: "webp", label: "WebP" },
] as const;

export const LANGUAGES = [
  { slug: "es", label: "Español" },
  { slug: "en", label: "English" },
] as const;

export const LICENSES = [
  { slug: "original", label: "Contenido original" },
  { slug: "creator", label: "Aporte del creador" },
  { slug: "cc", label: "Creative Commons" },
  { slug: "fair-use", label: "Parodia / uso legítimo" },
  { slug: "unknown", label: "Procedencia desconocida" },
] as const;

export const REPORT_REASONS = [
  { slug: "copyright", label: "Infringe mis derechos de autor (DMCA)" },
  { slug: "privacy", label: "Aparezco yo / datos personales sin permiso" },
  { slug: "offensive", label: "Contenido ofensivo, odio o acoso" },
  { slug: "broken", label: "La imagen no carga o está rota" },
  { slug: "spam", label: "Spam o publicidad" },
  { slug: "other", label: "Otro motivo" },
] as const;

const categorySlugs = new Set(CATEGORIES.map((c) => c.slug));

export const isCategory = (slug: string) => categorySlugs.has(slug);
export const categoryLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.es ?? slug;

/** Text folded into the search document for the given taxonomy slugs. */
export function taxonomyKeywords(categories: string[]): string {
  const parts: string[] = [];
  for (const slug of categories) {
    const c = CATEGORIES.find((x) => x.slug === slug);
    if (c) parts.push(c.en, c.es, ...c.keywords);
  }
  return parts.join(" ");
}
