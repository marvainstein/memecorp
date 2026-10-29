/**
 * Imgflip template searches by workplace topic, so each category has its classic reaction templates
 * ("Boardroom Meeting Suggestion", "Case of the Mondays", "As Per My Last Email").
 * Searches return plenty of unrelated templates (games, cartoons, Bollywood): a template is kept only
 * when its name mentions one of `mustMatch` and none of `exclude`. Matched as lowercase substrings.
 */
export type TopicSearch = {
  /** Category slug from taxonomy.ts that every template found here gets. */
  category: string;
  queries: string[];
  mustMatch: string[];
  exclude?: string[];
  /** Extra tags, so the topic's words in both languages find these templates. */
  tags: string[];
};

/** Names that keep coming up in topic searches and are never workplace humor: games, politics, news. */
const NOISE = [
  "among us", "minecraft", "pokemon", "kirby", "brawl stars", "undertale", "fnf", "fnaf", "friday night funkin", "payday 2", "cloaker",
  "dark souls", "cuphead", "spider man", "spiderman", "fortnite", "roblox", "anime", "hentai",
  "trump", "biden", "pfizer", "bitcoin", "satoshi", "new world order", "racism", "kari lake", "oprah", "bp oil", "sumner redstone",
  "astronomer", "vince mcmahon", "omarosa", "mangione", "shooter", "conservative", "liberal", "presidents", "federal", "nba", "nfl",
];

export const TOPIC_SEARCHES: TopicSearch[] = [
  {
    category: "reuniones",
    queries: ["meeting", "email", "zoom call"],
    mustMatch: ["meeting", "email", "zoom", "conference call"],
    exclude: ["aa meeting", "town hall", "hillary", "until we meet", "meet again", "i meet"],
    tags: ["reunion", "meeting", "email"],
  },
  {
    category: "jefes",
    // Searching "ceo" mostly finds news and politics; CEO templates still come in through "boss" and "manager".
    queries: ["boss", "manager"],
    mustMatch: ["boss", "manager", "ceo", "supervisor"],
    exclude: ["baby boss", "like a boss", "final boss", "boss fight", "boss battle", "coldplay", "girlboss", "boss baby"],
    tags: ["jefe", "boss", "manager"],
  },
  {
    category: "lunes",
    queries: ["monday", "friday"],
    mustMatch: ["monday", "friday"],
    exclude: ["boyfriend", "debo", "black friday", "good friday", "jason", "tony stark", "friday the 13th", "smokey", "craig", "chris tucker"],
    tags: ["lunes", "viernes", "monday", "friday"],
  },
  {
    category: "salario",
    queries: ["salary", "payday", "paycheck"],
    mustMatch: ["salary", "payday", "paycheck", "pay day"],
    exclude: ["salarian", "kitne", "kitni", "bhaiya", "salario", "johnny paycheck", "werewolf", "pimp", "mshroom", "mushroom", "payday gang", "intro", "bang bang"],
    tags: ["sueldo", "salary", "plata"],
  },
  {
    category: "burnout",
    queries: ["deadline", "burnout"],
    mustMatch: ["deadline", "overtime", "burnout", "burned out", "burnt out", "exhausted"],
    // "burnout" is also a car stunt and a racing game.
    exclude: ["trade", "exam", "essay", "car", "camaro", "challenger", "crash", "minotaur", "paradise", "bullitt", "ford", "chevy", "mustang"],
    tags: ["burnout", "deadline", "estres"],
  },
  {
    category: "companeros",
    queries: ["coworker", "coworkers"],
    mustMatch: ["coworker", "co-worker", "colleague"],
    exclude: ["do not fire"],
    tags: ["companero", "coworker"],
  },
  {
    category: "renuncias",
    queries: ["quit job", "quit my job", "you're fired"],
    mustMatch: ["quit", "you're fired", "youre fired", "resign"],
    exclude: ["emo band", "1 like", "mcdonalds", "quit smoking", "quitting smoking"],
    tags: ["renuncia", "quit", "despido"],
  },
  {
    category: "remoto",
    queries: ["work from home", "working from home"],
    mustMatch: ["work from home", "working from home", "wfh", "remote work"],
    tags: ["home office", "trabajo remoto", "work from home"],
  },
  {
    category: "rrhh",
    queries: ["human resources", "hr lady", "job interview"],
    mustMatch: ["human resources", "hr lady", "hr girl", "hr shows", "job interview"],
    tags: ["rrhh", "recursos humanos", "hr"],
  },
].map((t) => ({ ...t, exclude: [...(t.exclude ?? []), ...NOISE] }));
