/**
 * Workplace shows and films people search for by name. Each one drives:
 * - auto-tagging: a post whose title, caption or OCR text mentions any `terms` gets the show's tags. Terms
 *   must be unmistakable: characters and the show's own phrases, never words with an everyday meaning
 *   ("severance" pay, the "silicon valley" region, "the office" where you work);
 * - search: `names` form a synonym group, so "parks and rec" also finds "parks and recreation";
 * - the Imgflip importer: reaction templates found with `trusted` searches (the show's name: results
 *   are on-topic) and `queries` (characters: the template name must mention one of `mustMatch`).
 * Terms are matched as whole normalized words.
 */
export type Franchise = {
  id: string;
  name: string;
  /** Names and aliases people type. The first one is the display name. */
  names: string[];
  terms: string[];
  /** Extra tags beyond `names` (e.g. the Spanish title). */
  extraTags?: string[];
  imgflip: { trusted: string[]; queries: string[]; mustMatch: string[]; exclude?: string[] };
};

export const FRANCHISES: Franchise[] = [
  {
    id: "the-office",
    name: "The Office",
    names: ["the office", "dunder mifflin"],
    extraTags: ["la oficina"],
    terms: ["dunder mifflin", "michael scott", "dwight schrute", "schrute", "jim halpert", "pam beesly", "pam halpert", "kevin malone", "creed bratton", "stanley hudson", "andy bernard", "angela martin", "toby flenderson", "kelly kapoor", "prison mike", "steve carell"],
    imgflip: {
      trusted: ["the office", "dunder mifflin"],
      queries: [
        "michael scott", "dwight", "jim halpert", "pam beesly", "kevin malone", "creed bratton", "stanley hudson",
        "andy bernard", "angela office", "toby flenderson", "ryan howard office", "kelly kapoor", "oscar office", "prison mike",
      ],
      mustMatch: [
        "office", "michael", "scott", "dwight", "schrute", "jim", "halpert", "pam", "beesly", "kevin", "creed", "stanley",
        "andy", "bernard", "angela", "toby", "ryan", "kelly", "oscar", "prison mike", "dunder", "steve carell", "steve carrel",
        "krasinski", "rainn", "meredith", "phyllis", "darryl", "erin", "holly", "jan levinson",
      ],
      exclude: ["office space", "parks", "brooklyn", "spongebob", "simpsons", "the office of", "officer", "lumbergh"],
    },
  },
  {
    id: "parks-and-rec",
    name: "Parks and Recreation",
    names: ["parks and recreation", "parks and rec", "parks and recreations", "parks & rec", "pawnee"],
    terms: ["parks and recreation", "parks and rec", "ron swanson", "leslie knope", "april ludgate", "andy dwyer", "tom haverford", "ben wyatt", "chris traeger", "jean ralphio", "ann perkins", "jerry gergich", "donna meagle", "li l sebastian", "treat yo self"],
    imgflip: {
      trusted: ["parks and rec", "parks and recreation"],
      queries: ["ron swanson", "leslie knope", "april ludgate", "andy dwyer", "tom haverford", "ben wyatt", "chris traeger", "jerry gergich"],
      mustMatch: [
        "parks", "ron swanson", "swanson", "leslie", "knope", "april", "ludgate", "aubrey plaza", "andy dwyer", "chris pratt",
        "tom haverford", "haverford", "ben wyatt", "chris traeger", "traeger", "jerry", "gergich", "jean ralphio", "donna", "pawnee",
      ],
      exclude: ["jurassic", "star lord", "guardians"],
    },
  },
  {
    id: "nathan-fielder",
    name: "Nathan Fielder",
    names: ["nathan fielder", "nathan for you", "the rehearsal", "the rehersal", "you can see everything"],
    terms: ["nathan fielder", "nathan for you", "summit ice", "dumb starbucks"],
    imgflip: {
      trusted: ["nathan fielder", "nathan for you", "you can see everything"],
      queries: ["the rehearsal nathan", "the plan nathan"],
      mustMatch: ["nathan", "fielder", "rehearsal", "the plan", "you can see everything", "elizabeth holmes"],
    },
  },
  {
    id: "office-space",
    name: "Office Space",
    names: ["office space", "lumbergh"],
    terms: ["lumbergh", "tps report", "tps reports", "red stapler", "milton waddams", "initech"],
    imgflip: {
      trusted: ["office space"],
      queries: ["lumbergh", "tps report", "milton stapler"],
      mustMatch: ["office space", "lumbergh", "tps", "stapler", "milton", "initech", "that would be great", "yeah if you could", "told there would be"],
      exclude: ["darth vader", "spongebob", "hurricane"],
    },
  },
  {
    id: "severance",
    name: "Severance",
    names: ["severance", "lumon"],
    terms: ["lumon", "milchick", "macrodata refinement", "mark scout", "helly r", "your outie", "your innie", "waffle party"],
    imgflip: {
      trusted: [],
      queries: ["severance", "lumon", "outie", "innie"],
      mustMatch: ["severance", "lumon", "innie", "outie", "milchick", "helly", "mysterious and important", "waffle party", "macrodata"],
      exclude: ["spider"],
    },
  },
  {
    id: "silicon-valley",
    name: "Silicon Valley",
    names: ["silicon valley", "pied piper"],
    terms: ["gilfoyle", "erlich bachman", "richard hendricks", "gavin belson", "hooli", "jian yang"],
    imgflip: {
      trusted: ["silicon valley"],
      queries: ["gilfoyle", "dinesh", "erlich bachman", "richard hendricks", "gavin belson", "jian yang"],
      mustMatch: ["silicon valley", "gilfoyle", "dinesh", "erlich", "richard hendricks", "gavin belson", "jian yang", "hooli", "pied piper", "big head", "jared"],
      exclude: ["svb", "bank", "souza", "dineshu", "rittenhouse", "mules", "tech ceos"],
    },
  },
  {
    id: "it-crowd",
    name: "The IT Crowd",
    names: ["the it crowd", "it crowd"],
    terms: ["it crowd", "reynholm", "maurice moss"],
    imgflip: {
      trusted: ["it crowd"],
      queries: ["moss it crowd", "roy it crowd"],
      mustMatch: ["it crowd", "reynholm", "rest of the fire", "turning it off"],
    },
  },
  {
    id: "succession",
    name: "Succession",
    names: ["succession", "waystar royco"],
    terms: ["logan roy", "kendall roy", "roman roy", "shiv roy", "tom wambsgans", "cousin greg", "waystar royco"],
    imgflip: {
      trusted: [],
      queries: ["logan roy", "kendall roy", "roman roy", "tom wambsgans", "cousin greg"],
      mustMatch: ["logan roy", "kendall", "roman roy", "shiv", "wambsgans", "greg", "succession", "waystar"],
      exclude: ["good guy greg", "scumbag"],
    },
  },
  {
    id: "brooklyn-99",
    name: "Brooklyn Nine-Nine",
    names: ["brooklyn nine nine", "brooklyn 99", "b99"],
    terms: ["brooklyn nine nine", "brooklyn 99", "jake peralta", "captain holt", "raymond holt", "amy santiago", "rosa diaz", "charles boyle", "gina linetti"],
    imgflip: {
      trusted: ["brooklyn nine nine", "brooklyn 99"],
      queries: ["jake peralta", "captain holt", "amy santiago", "rosa diaz", "charles boyle", "gina linetti"],
      mustMatch: ["brooklyn", "b99", "nine nine", "peralta", "holt", "santiago", "rosa", "boyle", "gina", "terry", "hitchcock", "scully", "arlo"],
      exclude: ["nets", "bridge"],
    },
  },
  {
    id: "superstore",
    name: "Superstore",
    names: ["superstore", "cloud 9"],
    terms: ["glenn sturgis", "dina fox", "amy sosa", "cloud 9 store"],
    imgflip: {
      trusted: [],
      queries: ["superstore", "glenn superstore", "dina superstore"],
      mustMatch: ["superstore", "glenn", "dina", "mateo", "garrett", "myrtle", "amy sosa", "jonah"],
      exclude: ["target", "wal mart", "walmart", "black widow"],
    },
  },
  {
    id: "mad-men",
    name: "Mad Men",
    names: ["mad men", "don draper"],
    terms: ["mad men", "don draper", "peggy olson", "roger sterling", "sterling cooper"],
    imgflip: {
      trusted: ["mad men"],
      queries: ["don draper", "peggy olson", "roger sterling"],
      mustMatch: ["mad men", "draper", "jon hamm", "john hamm", "peggy", "roger sterling", "sterling cooper", "think about you at all"],
      exclude: ["neighbors"],
    },
  },
];

export const franchiseTagList = (f: Franchise) => [...new Set([...f.names, ...(f.extraTags ?? [])])];

export const franchiseById = (id: string) => FRANCHISES.find((f) => f.id === id);
