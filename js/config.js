// ===================== Nastavení =====================
// [emoji, název, id] – id je zároveň téma v Open Library (pokud v OL_SUBJECT není jinak)
const GENRES = [
  ["🐉", "Fantasy", "fantasy"], ["🌹", "Romantasy", "romantasy"], ["🖤", "Dark romance", "dark_romance"],
  ["🚀", "Sci-fi", "science_fiction"], ["🔎", "Detektivka", "detective_and_mystery_stories"], ["☕", "Pohodová detektivka", "cozy_mystery"],
  ["🔪", "Thriller", "thrillers"], ["🧩", "Psychologický thriller", "psychological_thrillers"], ["💘", "Romantika", "romance"],
  ["🏒", "Sportovní romance", "sports_romance"], ["💐", "Romány pro ženy", "women"], ["🏡", "Rodinné ságy", "family_saga"],
  ["💞", "New adult", "new_adult"], ["👻", "Horor", "horror"], ["🏰", "Historický román", "historical_fiction"],
  ["🧭", "Dobrodružství", "adventure_stories"], ["😂", "Humor", "humor"], ["🎩", "Klasika", "classic_literature"],
  ["🍥", "Manga", "manga"], ["💥", "Komiksy", "comics"], ["🧸", "Pro děti", "juvenile_fiction"],
  ["🎧", "Pro mládež", "young_adult_fiction"], ["🧚", "Pohádky", "fairy_tales"], ["⚔️", "Válečné", "war_stories"],
  ["🪶", "Poezie", "poetry"], ["🕵️", "True crime", "true_crime"], ["👤", "Životopisy", "biography"],
  ["📜", "Historie", "history"], ["🌱", "Seberozvoj", "self_help"], ["🧠", "Psychologie", "psychology"],
  ["💭", "Filozofie", "philosophy"],
];
// téma v Open Library, kde se liší od id (null = Open Library ho nezná, hledá se jen v ostatních zdrojích)
const OL_SUBJECT = {
  romantasy: "fantasy romance", dark_romance: "dark romance", cozy_mystery: "cozy mystery",
  psychological_thrillers: "psychological thrillers", sports_romance: "sports romance", women: null,
  family_saga: "family saga", new_adult: "new adult fiction", true_crime: "true crime", self_help: "self-help techniques",
};
const olSubject = (g) => (g in OL_SUBJECT ? OL_SUBJECT[g] : g.replace(/_/g, " "));

// Jazykové kódy MARC (používá je Open Library)
const LANGS = [
  ["cze", "čeština", "v češtině"], ["slo", "slovenština", "ve slovenštině"], ["", "jakýkoliv jazyk", ""],
  ["eng", "angličtina", "v angličtině"], ["ger", "němčina", "v němčině"], ["pol", "polština", "v polštině"],
  ["fre", "francouzština", "ve francouzštině"], ["spa", "španělština", "ve španělštině"],
  ["ita", "italština", "v italštině"], ["rus", "ruština", "v ruštině"],
];
const langIn = (code) => LANGS.find((l) => l[0] === code)?.[2] || "";

// Období podle roku prvního vydání
const YEAR = new Date().getFullYear();
const PERIODS = [
  ["new",  "Novinky (5 let)", [YEAR - 4, YEAR + 1]],
  ["2010", "2010 – " + (YEAR - 5),         [2010, YEAR - 5]],
  ["2000", "2000 – 2009",                  [2000, 2009]],
  ["1950", "1950 – 1999",                  [1950, 1999]],
  ["1900", "1900 – 1949",                  [1900, 1949]],
  ["old",  "Starší než 1900",              ["*", 1899]],
  ["",     "Kdykoliv",                     null],
];
const periodQuery = (id) => {
  const p = PERIODS.find((x) => x[0] === id)?.[2];
  return p ? `first_publish_year:[${p[0]} TO ${p[1]}]` : "";
};

const THEMES = [
  ["indigo", "Indigo", "#6d5dfc", "#c04bff"], ["mata", "Máta", "#0e9f7e", "#23a0ab"],
  ["koral", "Korál", "#f2545b", "#e07000"], ["ocean", "Oceán", "#1f63e8", "#1b9cc1"],
  ["noc", "Noc", "#8b7bff", "#ef59ab"], ["les", "Les", "#3ecf8e", "#c8e64a"],
];

// Uložené seznamy (v prohlížeči)
const LISTS = {
  fav:  { store: "oblibene",        icon: "♥",  label: "Oblíbené",        add: "Přidat do oblíbených",     empty: "Zatím nemáš žádné oblíbené knihy. Přidáš je srdíčkem ♥.", quick: true },
  want: { store: "chci-si-precist", icon: "🔖", label: "Chci si přečíst", add: "Uložit na později",         empty: "Tady budou knihy, které si chceš přečíst. Uložíš je záložkou 🔖.", quick: true },
  reading: { store: "ctu",          icon: "📖", label: "Právě čtu",       add: "Právě čtu" },
  read:    { store: "precteno",     icon: "✅", label: "Přečteno",        add: "Mám přečteno" },
};
// kniha může být jen v jednom z těchto stavů (oblíbené jsou zvlášť)
const STATUS = ["want", "reading", "read"];
// všechno, co si aplikace ukládá do prohlížeče (pro zálohu)
const BACKUP_KEYS = ["oblibene", "chci-si-precist", "ctu", "precteno", "moje-hodnoceni", "prectene-dily", "vyzva", "sledovani", "tema", "uvitani", "odznaky"];

const API = "https://openlibrary.org";

// ---- Google Books (druhý zdroj – hlavně nové české knihy a české popisy) ----
// Klíč je vidět v kódu stránky, proto je v Google Cloud omezený jen na Books API.
const GOOGLE_BOOKS_KEY = "AIzaSyDgCXb48CTtw9teme13RL7U5-nUi3WFcmM";
const GB_API = "https://www.googleapis.com/books/v1/volumes";

// ---- Zpětná vazba a statistika – prázdná hodnota = vypnuto ----
const FEEDBACK_ENDPOINT = "https://formspree.io/f/mdekjqkw"; // formulář „Napiš nám“ (Formspree)
const GOATCOUNTER = "";       // název účtu GoatCounter, např. "listuj" (z adresy listuj.goatcounter.com)

// délka knihy podle počtu stran
const LENGTHS = { short: [0, 250], mid: [251, 500], long: [501, "*"] };
const GB_PAGE = 20;
const GB_LANG = { cze: "cs", slo: "sk", eng: "en", ger: "de", pol: "pl", fre: "fr", spa: "es", ita: "it", rus: "ru" };
// Google Books hledá dobře jen podle českých slov; kategorie odfiltruje učebnice a odborné knihy
const FICTION = /fiction/i;
const GB_GENRES = {
  fantasy: ["fantasy román", FICTION],
  science_fiction: ["vědeckofantastický román", FICTION],
  detective_and_mystery_stories: ["detektivka", FICTION],
  thrillers: ["thriller", FICTION],
  romance: ["romantický román", FICTION],
  horror: ["hororový román", FICTION],
  historical_fiction: ["historický román", FICTION],
  adventure_stories: ["dobrodružný román", FICTION],
  humor: ["humoristický román", FICTION],
  juvenile_fiction: ["pro děti", /juvenile/i],
  young_adult_fiction: ["pro mládež", /juvenile|young adult/i],
  fairy_tales: ["pohádky", /juvenile|fiction|folklore|fairy/i],
  war_stories: ["válečný román", FICTION],
  poetry: ["básně", /poetry/i],
  biography: ["životopis", /biography/i],
  history: ["historie", /history/i],
  psychology: ["psychologie", /psychology|self-help/i],
  philosophy: ["filozofie", /philosophy/i],
  romantasy: ["romantasy", FICTION],
  dark_romance: ["dark romance", FICTION],
  cozy_mystery: ["pohodová detektivka", FICTION],
  psychological_thrillers: ["psychologický thriller", FICTION],
  sports_romance: ["sportovní romance", FICTION],
  women: ["román pro ženy", FICTION],
  family_saga: ["rodinná sága", FICTION],
  new_adult: ["new adult", FICTION],
  manga: ["manga", /comics|manga|graphic/i],
  comics: ["komiks", /comics|graphic/i],
  true_crime: ["true crime", null],
  self_help: ["seberozvoj", /self-help|psychology/i],
};
const LIMIT = 24;
const FIELDS = "key,title,author_name,author_key,first_publish_year,cover_i,ratings_average,ratings_count,edition_count,number_of_pages_median,ebook_access,ia,editions,editions.title,editions.key,editions.cover_i,editions.language";

const $ = (id) => document.getElementById(id);
const state = {
  mode: "genre", genres: [], genreMode: "any", page: 1, total: 0, books: [], view: "results",
  controller: null, searched: false, author: null, fromApp: false, top: false,
};
const cache = new Map();

// ---- Knihovny.cz (souhrnný katalog českých knihoven) – nejnovější české knihy s českými anotacemi ----
const KC_API = "https://www.knihovny.cz/api/v1";
const KC_PAGE = 40;
const KC_FIELDS = ["id", "title", "authors", "publicationDates", "formats", "cleanIsbn", "summary", "subjects", "publishers", "physicalDescriptions", "dedupIds"];
const KC_LANG = { cze: "Czech", slo: "Slovak", eng: "English", ger: "German", pol: "Polish", fre: "French", spa: "Spanish", ita: "Italian", rus: "Russian" };
const KC_GENRES = {
  fantasy: "fantasy", science_fiction: "vědeckofantastické romány", detective_and_mystery_stories: "detektivní romány",
  thrillers: "thrillery", romance: "milostné romány", horror: "horory", historical_fiction: "historické romány",
  adventure_stories: "dobrodružné romány", humor: "humoristické romány", classic_literature: "klasická literatura",
  juvenile_fiction: "příběhy pro děti", young_adult_fiction: "romány pro mládež", fairy_tales: "pohádky",
  war_stories: "válečné romány", poetry: "poezie", biography: "biografie", history: "dějiny",
  psychology: "psychologie", philosophy: "filozofie", dystopias: "dystopie",
  romantasy: "fantasy AND milostné romány", dark_romance: "dark romance", psychological_thrillers: "psychologické thrillery",
  sports_romance: "sportovní AND milostné romány", women: "romány pro ženy", family_saga: "rodinné ságy", new_adult: "new adult",
  manga: "manga", comics: "komiksy", true_crime: "skutečné kriminální případy", self_help: "osobní rozvoj",
};

// ---- Hledání vlastními slovy: česká slova → žánry (porovnává se bez diakritiky) ----
const MOODS = [
  [/romantasy/, "romantasy", "romantasy"],
  [/psychologick\w* (thriller|trhak)/, "psychological_thrillers", "psychologický thriller"],
  [/new adult/, "new_adult", "new adult"],
  [/pro zeny|zensk\w* roman|cervena knihovna/, "women", "romány pro ženy"],
  [/inspirativ|motivac|motivuj|osobni rozvoj|seberozvoj/, "self_help", "seberozvoj"],
  [/dark romance|temn\w* romant/, "dark_romance", "dark romance"],
  [/pohodov\w* detektiv|cozy/, "cozy_mystery", "pohodová detektivka"],
  [/manga|anime/, "manga", "manga"],
  [/komiks/, "comics", "komiksy"],
  [/true crime|skutecn\w* zlocin|skutecn\w* vrazd/, "true_crime", "true crime"],
  [/sportovn\w* romant|hokejist|fotbalist/, "sports_romance", "sportovní romance"],
  [/rodinn\w* sag/, "family_saga", "rodinná sága"],
  [/napinav|napet|adrenalin|thriller/, "thrillers", "napínavé"],
  [/detektiv|krimi|vrazd|vysetrov|zlocin|zahad|mysteri/, "detective_and_mystery_stories", "detektivka"],
  [/horor|strasideln|desiv|hruz/, "horror", "horor"],
  [/fantasy|magi|kouzl|drak|carodej|elf/, "fantasy", "fantasy"],
  [/sci-?fi|vesmir|budoucnost|robot|mimozemst|planet/, "science_fiction", "sci-fi"],
  [/romant|lask[auyo]|lasce|zamilov/, "romance", "romantika"],
  [/vtip|humor|sranda|smes|pobav|zabavn|komedi|oddechov|odpocink|lehk\w* (cten|knih)|na dovolenou|na plaz/, "humor", "oddechové a vtipné"],
  [/histor|stredovek|minulost/, "historical_fiction", "historické"],
  [/dobrodruz|cestovan|vyprav/, "adventure_stories", "dobrodružné"],
  [/valk|valce|valecn|vojak/, "war_stories", "válečné"],
  [/klasik|klasick/, "classic_literature", "klasika"],
  [/pohad/, "fairy_tales", "pohádky"],
  [/pro deti|detsk|pro dite|pro syna|pro dceru/, "juvenile_fiction", "pro děti"],
  [/mladez|teenager|dospivaj|young adult|nactilet/, "young_adult_fiction", "pro mládež"],
  [/basn|poezi|verse/, "poetry", "poezie"],
  [/zivotopis|biografi|skutecn/, "biography", "podle skutečnosti"],
  [/psycholog|dusevn/, "psychology", "psychologie"],
  [/filozof|smysl zivota/, "philosophy", "filozofie"],
  [/dystopi|postapo|konec sveta/, "dystopias", "dystopie"],
  [/dojem|smutn|plakat|slzy|tragick/, "grief", "dojemné"],
];
// Motivy a témata – hledají se navíc k žánru (všechny musí sedět): [výraz, téma v Open Library, téma v katalogu knihoven, popisek]
const TOPICS = [
  [/upir|vampyr/, "vampires", "upíři", "upíři"],
  [/vlkodla/, "werewolves", "vlkodlaci", "vlkodlaci"],
  [/drak|draci|draku/, "dragons", "draci", "draci"],
  [/carodejnic/, "witches", "čarodějnice", "čarodějnice"],
  [/\sduch|strasidl|duchove/, "ghosts", "duchové", "duchové"],
  [/zombi/, "zombies", "zombie", "zombie"],
  [/cestovan\w* casem|stroj\w* cas/, "time travel", "cestování časem", "cestování časem"],
  [/umel\w* inteligenc|robot/, "robots", "roboti", "roboti a umělá inteligence"],
  [/vesmir|kosmos|kosmick/, "outer space", "vesmír", "vesmír"],
  [/pirat/, "pirates", "piráti", "piráti"],
  [/spion|tajn\w* agent/, "spies", "špioni", "špioni"],
  [/mafi/, "mafia", "mafie", "mafie"],
  [/skol|internat|akademi/, "schools", "školy", "škola"],
  [/pratelst|kamarad/, "friendship", "přátelství", "přátelství"],
  [/rodin|sourozen/, "families", "rodina", "rodina"],
  [/zvir|pejsk|psick|\spes\s|kock|konic|\skone\s|\skun\s/, "animals", "zvířata", "zvířata"],
  [/sport|fotbal|hokej/, "sports", "sport", "sport"],
  [/hudb|muzik|kapel/, "music", "hudba", "hudba"],
  [/vareni|kuchar|jidl|pekar|cukrar/, "cooking", "vaření", "jídlo a vaření"],
  [/druh\w* svetov|holocaust|holokaust/, "world war, 1939-1945", "druhá světová válka", "2. světová válka"],
  [/prv\w* svetov/, "world war, 1914-1918", "první světová válka", "1. světová válka"],
  [/stredovek/, "middle ages", "středověk", "středověk"],
  [/praze|praha|prahy|prazsk/, "prague (czech republic)", "Praha", "Praha"],
  [/japon/, "japan", "Japonsko", "Japonsko"],
  [/povidk/, "short stories", "povídky", "povídky"],
];
const MOOD_EXAMPLES = [
  "něco napínavého, co právě vyšlo",
  "něco jako Harry Potter",
  "romantika s upíry",
  "detektivka z Prahy",
  "čerstvá romantasy",
  "něco napínavého, ale ne horor",
  "vtipná kniha na dovolenou",
  "krátká romantika",
  "fantasy s draky pro mládež",
  "dojemný příběh podle skutečnosti",
  "česká detektivka, novinky",
];
