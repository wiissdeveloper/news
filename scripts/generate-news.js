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
const MAX_RETRIES = 3;
const TIMEOUT_MS = 5000;

// RANGOS DINÁMICOS POR PAÍS
const RANGES = {
  es: [30, 60, 120],
  fr: [30, 60, 120],
  it: [30, 60, 120, 180], // Italia necesita más rango
  de: [30, 60, 120],
  pt: [30, 60, 120],
  en: [30, 60, 120]
};

// FUENTES ALTERNATIVAS POR PAÍS
const SOURCES_ALT = {
  it: [
    "https://www.ilvideogioco.com/feed/",
    "https://www.gamesource.it/feed/",
    "https://www.nintendoomed.it/feed/",
    "https://www.pcgaming.it/feed/"
  ],
  es: [
    "https://areajugones.sport.es/feed/",
    "https://www.vidaextra.com/feed"
  ],
  fr: [
    "https://www.jeuxactu.com/rss/",
    "https://www.gameblog.fr/rss"
  ],
  de: [],
  pt: [],
  en: []
};

// ===============================
//  FETCH MANUAL CON HEADERS + TIMEOUT + REINTENTOS
// ===============================
async function fetchXML(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept":
            "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8"
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) throw new Error("HTTP " + res.status);

      const xml = await res.text();
      const feed = await parser.parseString(xml);

      return (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

    } catch (err) {
      console.log(`Error en ${url} (intento ${attempt})`);
      if (attempt === MAX_RETRIES) return [];
    }
  }
}

// ===============================
//  FETCH RSS (USA fetchXML, NO parseURL)
// ===============================
async function fetchRSS(url) {
  return await fetchXML(url);
}

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
// ===============================
//  GENERAR NOTICIAS POR IDIOMA (NUEVO)
// ===============================
async function generateForLang(lang, log) {
  log.push(`\n=== ${lang.toUpperCase()} ===`);

  // 1. DESCARGAR FUENTES PRINCIPALES
  const primaryFeeds = await Promise.all(SOURCES[lang].map(fetchRSS));
  let all = primaryFeeds.flat().map(item => ({
    guid: item.guid || item.link,
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    contentSnippet: item.contentSnippet || item.content || "",
    thumbnail: extractImage(item)
  }));

  // 2. FILTROS BÁSICOS
  all = all
    .filter(isGamingNews)
    .filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));

  all = removeDuplicates(all);

  log.push(`Noticias locales encontradas: ${all.length}`);

  let final = [];

  // 3. RANGO DINÁMICO POR PAÍS
  for (const days of RANGES[lang]) {
    const filtered = all.filter(n => isRecent(n, days));
    if (filtered.length >= TOTAL) {
      final = filtered;
      log.push(`Rango aplicado: ${days} días`);
      break;
    }
  }

  // Si aún no hay suficientes, usar TODO lo disponible
  if (final.length < TOTAL) {
    final = [...final, ...all];
  }

  // 4. FUENTES ALTERNATIVAS SI FALTAN NOTICIAS
  if (final.length < TOTAL && SOURCES_ALT[lang].length > 0) {
    log.push("Usando fuentes alternativas…");

    const altFeeds = await Promise.all(SOURCES_ALT[lang].map(fetchRSS));
    let alt = altFeeds.flat().map(item => ({
      guid: item.guid || item.link,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: item.contentSnippet || item.content || "",
      thumbnail: extractImage(item)
    }));

    alt = alt
      .filter(isGamingNews)
      .filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));

    alt = removeDuplicates(alt);

    all.push(...alt);
    final.push(...alt);
  }

  // 5. FALLBACK INGLÉS
  if (final.length < TOTAL && lang !== "en") {
    log.push("Usando fallback inglés…");

    const fallbackFeeds = await Promise.all(SOURCES["en"].map(fetchRSS));
    let fallback = fallbackFeeds.flat().map(item => ({
      guid: item.guid || item.link,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: item.contentSnippet || item.content || "",
      thumbnail: extractImage(item)
    }));

    fallback = fallback
      .filter(isGamingNews)
      .filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));

    fallback = removeDuplicates(fallback);

    final.push(...fallback);
  }

  // 6. ORDENAR Y CORTAR
  final.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  final = final.slice(0, TOTAL);

  log.push(`Total final: ${final.length}`);

  // 7. GUARDAR JSON
  const today = new Date().toISOString().split("T")[0];
  fs.writeFileSync(
    `news_${lang}.json`,
    JSON.stringify({ date: today, notices: final }, null, 2)
  );
}


// ===============================
//  MAIN + LOG FINAL
// ===============================
async function main() {
  const log = [];

  for (const lang of Object.keys(SOURCES)) {
    await generateForLang(lang, log);
  }

  fs.writeFileSync("news_log.txt", log.join("\n"));
}

main();
