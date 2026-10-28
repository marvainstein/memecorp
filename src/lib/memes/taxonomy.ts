/**
 * Fixed taxonomies. Slugs are what gets stored in the database; labels and keywords
 * are folded into each meme's search document so "cansado" finds memes tagged `tired`.
 */
export type TaxonomyItem = { slug: string; en: string; es: string; keywords: string[] };

export const EMOTIONS: TaxonomyItem[] = [
  { slug: "happy", en: "Happy", es: "Feliz", keywords: ["contento", "alegre", "felicidad", "joy", "glad", "smile", "sonrisa"] },
  { slug: "sad", en: "Sad", es: "Triste", keywords: ["tristeza", "llorar", "crying", "llanto", "depre", "bajon"] },
  { slug: "angry", en: "Angry", es: "Enojado", keywords: ["enojo", "furioso", "ira", "rabia", "mad", "rage", "bronca"] },
  { slug: "sarcastic", en: "Sarcastic", es: "Sarcástico", keywords: ["sarcasmo", "ironia", "ironico", "sarcasm", "irony"] },
  { slug: "tired", en: "Tired", es: "Cansado", keywords: ["cansancio", "sueno", "agotado", "exhausted", "sleepy", "fiaca"] },
  { slug: "burnt-out", en: "Burnt out", es: "Quemado", keywords: ["burnout", "agotamiento", "quemado", "estres", "stress"] },
  { slug: "awkward", en: "Awkward", es: "Incómodo", keywords: ["incomodo", "verguenza", "cringe", "awkward", "nervioso"] },
  { slug: "shocked", en: "Shocked", es: "En shock", keywords: ["sorpresa", "sorprendido", "shock", "surprised", "omg", "incredulo"] },
  { slug: "passive-aggressive", en: "Passive aggressive", es: "Pasivo-agresivo", keywords: ["pasivo agresivo", "per my last email", "segun mi ultimo correo"] },
  { slug: "fake-enthusiasm", en: "Fake enthusiasm", es: "Entusiasmo fingido", keywords: ["fingido", "falso", "forzado", "fake smile", "sonrisa falsa"] },
  { slug: "relatable", en: "Relatable", es: "Me identifica", keywords: ["identificado", "literal yo", "same", "mood", "tal cual"] },
  { slug: "chaos", en: "Chaos", es: "Caos", keywords: ["caos", "desastre", "incendio", "fire", "everything is fine", "todo bien"] },
  { slug: "confused", en: "Confused", es: "Confundido", keywords: ["confusion", "no entiendo", "huh", "what", "que"] },
  { slug: "excited", en: "Excited", es: "Emocionado", keywords: ["emocion", "hype", "entusiasmo", "excited", "ansioso"] },
  { slug: "dead-inside", en: "Dead inside", es: "Muerto por dentro", keywords: ["vacio", "sin alma", "dead inside", "nada me importa"] },
  { slug: "overwhelmed", en: "Overwhelmed", es: "Abrumado", keywords: ["abrumado", "saturado", "desbordado", "too much", "colapsado"] },
  { slug: "unbothered", en: "Unbothered", es: "Me da igual", keywords: ["tranqui", "relajado", "chill", "no me importa", "zen"] },
  { slug: "celebrating", en: "Celebrating", es: "Celebrando", keywords: ["celebrar", "festejo", "fiesta", "party", "viernes", "logro"] },
];

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

const emotionSlugs = new Set(EMOTIONS.map((e) => e.slug));
const categorySlugs = new Set(CATEGORIES.map((c) => c.slug));

export const isEmotion = (slug: string) => emotionSlugs.has(slug);
export const isCategory = (slug: string) => categorySlugs.has(slug);
export const emotionLabel = (slug: string) => EMOTIONS.find((e) => e.slug === slug)?.en ?? slug;
export const categoryLabel = (slug: string) => CATEGORIES.find((c) => c.slug === slug)?.es ?? slug;

/** Text folded into the search document for the given taxonomy slugs. */
export function taxonomyKeywords(emotions: string[], categories: string[]): string {
  const parts: string[] = [];
  for (const slug of emotions) {
    const e = EMOTIONS.find((x) => x.slug === slug);
    if (e) parts.push(e.en, e.es, ...e.keywords);
  }
  for (const slug of categories) {
    const c = CATEGORIES.find((x) => x.slug === slug);
    if (c) parts.push(c.en, c.es, ...c.keywords);
  }
  return parts.join(" ");
}
