import Parser from "rss-parser";
import fs from "fs";

const parser = new Parser({
  customFields: {
    item: [
      ["media:thumbnail", "thumbnail"],
      ["media:content", "mediaContent"],
      ["enclosure", "enclosure"]
    ]
  }
});

const TOTAL = 12;
const MAX_ITEMS_PER_FEED = 150;

// Rango estándar
const MAX_DAYS_BACK = 30;
const MAX_DAYS_BACK_EXTENDED = 60;

// Rango especial FR/IT
const MAX_DAYS_FR_IT = 120;

// ===============================
//  FUENTES POR IDIOMA
// ===============================
const SOURCES = {
  es: [
    "https://vandal.elespanol.com/xml.cgi",
    "https://www.3djuegos.com/rss/rss.xml",
    "https://as.com/rss/meristation/portada.xml",
    "https://www.hobbyconsolas.com/rss"
  ],
  fr: [
    "https://www.jeuxvideo.com/rss/rss.xml",
    "https://www.gamekult.com/feed.xml",
    "https://www.actugaming.net/feed/"
  ],
  it: [
    "https://www.everyeye.it/feed/feed_rss.asp",
    "https://multiplayer.it/notizie.xml",
    "https://www.spaziogames.it/feed/",
    "https://www.ilvideogioco.com/feed/",
    "https://www.player.it/feed/",
    "https://www.gamesvillage.it/feed/",
    "https://www.tomshw.it/videogioco/feed/"
  ],
  de: [
    "https://www.gamestar.de/news/rss/news.rss",
    "https://www.pcgames.de/rss/news.xml",
    "https://mein-mmo.de/feed/"
  ],
  pt: [
    "https://www.eurogamer.pt/?format=rss",
    "https://meusjogos.pt/feed/"
  ],
  en: [
    "https://gamerant.com/feed/",
    "https://www.gameinformer.com/rss.xml",
    "https://www.pcgamer.com/rss/"
  ]
};

// ===============================
//  PALABRAS CLAVE GAMER
// ===============================
const GAMER_KEYWORDS = [
  "game", "gaming", "videojuego", "video game", "juego",
  "ps5", "playstation", "ps4", "ps3",
  "xbox", "series x", "series s", "one",
  "nintendo", "switch", "zelda", "mario", "pokemon",
  "steam", "pc gaming", "pc",
  "trailer", "review", "análisis", "avance",
  "dlc", "expansión", "update", "actualización",
  "esports", "torneo", "competitivo",
  "launch", "release", "lanzamiento",
  "fps", "rpg", "shooter", "battle royale",
  "retro", "emulador", "emulación"
];

// ===============================
//  PALABRAS CLAVE ANTI-CINE / ANIME / SERIES
// ===============================
const MOVIE_KEYWORDS = [
  "película", "pelicula", "movie", "film", "cine",
  "actor", "actriz", "director",
  "taquilla", "box office"
];

const ANIME_KEYWORDS = [
  "anime", "manga", "one piece", "dragon ball", "naruto",
  "bleach", "haki", "luffy", "zoro", "gear 5"
];

const SERIES_KEYWORDS = [
  "season", "episode", "serie", "series", "temporada",
  "house of the dragon", "netflix", "hbo", "prime video"
];

// ===============================
//  FILTRO GAMER REAL
// ===============================
function isGamingNews(item) {
  const text = `${item.title} ${item.contentSnippet || ""}`.toLowerCase();

  const isGame = GAMER_KEYWORDS.some(k => text.includes(k));
  const isMovie = MOVIE_KEYWORDS.some(k => text.includes(k));
  const isAnime = ANIME_KEYWORDS.some(k => text.includes(k));
  const isSeries = SERIES_KEYWORDS.some(k => text.includes(k));

  return isGame && !isMovie && !isAnime && !isSeries;
}

// ===============================
//  RANGO TEMPORAL
// ===============================
function isRecent(item, days) {
  const diff = (Date.now() - new Date(item.pubDate)) / (1000 * 60 * 60 * 24);
  return diff <= days;
}

// ===============================
//  EXTRAER IMAGEN REAL
// ===============================
function extractImage(item) {
  const tryUrl = (v) => {
    if (!v) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object" && v.url) return v.url;
    if (Array.isArray(v) && v[0]?.url) return v[0].url;
    return null;
  };

  return (
    tryUrl(item.thumbnail) ||
    tryUrl(item.mediaContent) ||
    tryUrl(item.enclosure) ||
    (item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ?? null)
  );
}

// ===============================
//  FETCH RSS CON TIMEOUT
// ===============================
function fetchWithTimeout(url, timeout = 5000) {
  return Promise.race([
    parser.parseURL(url),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeout)
    )
  ]);
}

async function fetchRSS(url) {
  try {
    const feed = await fetchWithTimeout(url);
    return (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);
  } catch {
    console.log("Timeout o error en:", url);
    return [];
  }
}

// ===============================
//  ELIMINAR DUPLICADOS
// ===============================
function removeDuplicates(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    const key = (item.guid || item.link || item.title).toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

// ===============================
//  GENERAR NOTICIAS POR IDIOMA
// ===============================
async function generateForLang(lang) {
  const feeds = SOURCES[lang];

  // Descargar todos los RSS en paralelo
  const results = await Promise.all(feeds.map(fetchRSS));

  // Aplanar
  let all = results.flat().map(item => ({
    guid: item.guid || item.link,
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    contentSnippet: item.contentSnippet || item.content || "",
    thumbnail: extractImage(item)
  }));

  // Filtrar gamer + imagen válida
  all = all.filter(isGamingNews)
           .filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));

  // Eliminar duplicados
  all = removeDuplicates(all);

  // Precalcular rangos
  const r30 = all.filter(n => isRecent(n, MAX_DAYS_BACK));
  const r60 = all.filter(n => isRecent(n, MAX_DAYS_BACK_EXTENDED));
  const r120 = (lang === "fr" || lang === "it")
    ? all.filter(n => isRecent(n, MAX_DAYS_FR_IT))
    : [];

  let final = [...r30];

  if (final.length < TOTAL) final = [...final, ...r60];
  if (final.length < TOTAL) final = [...final, ...r120];
  if (final.length < TOTAL) final = [...final, ...all];

  // Fallback inglés
  if (final.length < TOTAL && lang !== "en") {
    const fallbackFeeds = await Promise.all(SOURCES["en"].map(fetchRSS));
    let fallback = fallbackFeeds.flat()
      .map(item => ({
        guid: item.guid || item.link,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        contentSnippet: item.contentSnippet || item.content || "",
        thumbnail: extractImage(item)
      }))
      .filter(isGamingNews)
      .filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));

    fallback = removeDuplicates(fallback);

    final = [...final, ...fallback];
  }

  // Orden final
  final.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Cortar a 12
  final = final.slice(0, TOTAL);

  const today = new Date().toISOString().split("T")[0];

  fs.writeFileSync(
    `news_${lang}.json`,
    JSON.stringify({ date: today, notices: final }, null, 2)
  );
}

// ===============================
async function main() {
  for (const lang of Object.keys(SOURCES)) {
    console.log("Generating:", lang);
    await generateForLang(lang);
  }
}

main();
