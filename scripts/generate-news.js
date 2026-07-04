import Parser from "rss-parser";
import fs from "fs";
import iconv from "iconv-lite";

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
// 🔥 TIMEOUT subido a 10 segundos para dar margen a las fuentes europeas
const TIMEOUT_MS = 10000; 

// ===============================
// RANGOS DINÁMICOS POR PAÍS (Solo los 4 de Vortex Gamer)
// ===============================
const RANGES = {
  es: [30, 60, 120],
  fr: [30, 60, 120],
  it: [30, 60, 120, 180],
  en: [30, 60, 120]
};

// ===============================
// FUENTES ALTERNATIVAS POR PAÍS
// ===============================
const SOURCES_ALT = {
  it: [
    "https://multiplayer.it/feed/rss/news/",
    "https://www.ilvideogioco.com/feed/",
    "https://www.gamesource.it/feed/",
    "https://www.nintendoomed.it/feed/"
  ],
  es: [
    "https://areajugones.sport.es/feed/",
    "https://www.vidaextra.com/feed"
  ],
  fr: [
    "https://www.jeuxactu.com/rss/",
    "https://www.gameblog.fr/rss"
  ],
  en: []
};

// ===============================
// FETCH MANUAL CON HEADERS + TIMEOUT + REINTENTOS
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

      const buffer = Buffer.from(await res.arrayBuffer());
      const xmlDecl = buffer.toString("ascii", 0, 200).match(/encoding="([^"]+)"/i);
      const encoding = xmlDecl ? xmlDecl[1].toLowerCase() : "utf-8";
      const xml = iconv.decode(buffer, encoding);

      const feed = await parser.parseString(xml);
      return (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);

    } catch (err) {
      console.log(`Error en ${url} (intento ${attempt})`);
      if (attempt === MAX_RETRIES) return [];
    }
  }
}

function cleanText(str) {
  if (!str) return "";
  return str
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&eacute;/g, "é")
    .replace(/&aacute;/g, "á")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ");
}

async function fetchRSS(url) {
  return await fetchXML(url);
}

// ===============================
// FUENTES POR IDIOMA
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
    "https://multiplayer.it/feed/rss/news/",   
    "https://www.ilvideogioco.com/feed/",      
    "https://www.gamesource.it/feed/",         
    "https://www.thegamesmachine.it/feed/",
    "https://it.ign.com/feed.xml",
    "https://www.game-experience.it/feed/"
  ],
  en: [
    "https://gamerant.com/feed/",
    "https://www.gameinformer.com/rss.xml",
    "https://www.pcgamer.com/rss/"
  ]
};

// ===============================
// PALABRAS CLAVE GAMER
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
  "retro", "emulador", "emulación", 
  "gameplay", "consola", "console", "indie", "multijugador", "multiplayer"
];

// ===============================
// PALABRAS CLAVE ANTI‑CINE / ANIME / SERIES (¡Muro Internacional!)
// ===============================
const MOVIE_KEYWORDS = [
  // Términos generales (Multi-idioma)
  "película", "pelicula", "movie", "film", "cine", "cinéma", "cinema",
  "actor", "actriz", "actress", "acteur", "attore", "attrice",
  "director", "réalisateur", "regista", "reparto", "cast", "casting",
  "rodaje", "filming", "tournage", "riprese", "taquilla", "box office", "box-office", "botteghino",
  "marvel", "mcu", "hollywood", "cinta", "largometraje", "cartelera", "estreno en cines",
  "salles de cinéma", "sale cinematografiche", "pellicola", "oscar", "oscars", "taquillazo", "blockbuster",
  // Actores propensos a colarse y otros términos
  "tom holland", "zendaya", "timothée chalamet", "timothee chalamet", 
  "tom cruise", "margot robbie", "ryan reynolds", "robert downey jr", 
  "sydney sweeney", "dwayne johnson", "the rock", "live action", "live-action"
];

const ANIME_KEYWORDS = [
  "anime", "manga", "one piece", "dragon ball", "naruto", "bleach", 
  "haki", "luffy", "zoro", "gear 5", "crunchyroll", 
  "jujutsu kaisen", "demon slayer", "my hero academia"
];

const SERIES_KEYWORDS = [
  // Multi-idioma
  "season", "episode", "serie", "series", "temporada", "stagione", "saison", "episodio", "épisode",
  // Plataformas y franquicias
  "netflix", "hbo", "prime video", "disney+", "showrunner", "streaming", 
  "house of the dragon", "the boys", "stranger things"
];

// ===============================
// PALABRAS CLAVE ANTI‑POLÍTICA (Multi-idioma)
// ===============================
const POLITICS_KEYWORDS = [
  " politica ", " politics ", " elezioni ", " election ", " politique ",
  " governo ", " government ", " parlamento ", " parliament ", " gobierno ", " congreso ", " gouvernement ", " parlement ",
  " ministro ", " minister ", " presidente ", " president ", " alcalde ", " maire ", " sindaco ", " président ", " ministre ",
  " senato ", " senate ", " elecciones ", " diputados ", " sénat ", " élection "
];

// ===============================
// FILTRO GAMER + ANTI‑POLÍTICA (Aplicado a todos los idiomas)
// ===============================
function isGamingNews(item, lang) {
  const text = ` ${item.title} ${item.contentSnippet || ""} `.toLowerCase();

  const isGame = GAMER_KEYWORDS.some(k => text.includes(k));
  const isMovie = MOVIE_KEYWORDS.some(k => text.includes(k));
  const isAnime = ANIME_KEYWORDS.some(k => text.includes(k));
  const isSeries = SERIES_KEYWORDS.some(k => text.includes(k));
  const isPolitics = POLITICS_KEYWORDS.some(k => text.includes(k));

  return isGame && !isMovie && !isAnime && !isSeries && !isPolitics;
}

// ===============================
// RANGO TEMPORAL
// ===============================
function isRecent(item, days) {
  const d = new Date(item.pubDate);
  if (isNaN(d.getTime())) return true; 
  const diff = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diff <= days;
}

// ===============================
// EXTRAER IMAGEN REAL
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
// ELIMINAR DUPLICADOS (A PRUEBA DE BALAS)
// ===============================
function removeDuplicates(items) {
  const seen = new Set();
  const result = [];

  for (const item of items) {
    let rawKey = item.guid || item.link || item.title || "";

    if (typeof rawKey === "object" && rawKey !== null) {
      rawKey = rawKey._ || rawKey.url || rawKey.href || JSON.stringify(rawKey);
    }

    const key = String(rawKey).toLowerCase();

    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

// ===============================
// GENERAR NOTICIAS POR IDIOMA (CON TRY/CATCH)
// ===============================
async function generateForLang(lang, log) {
  log.push(`\n=== ${lang.toUpperCase()} ===`);

  try {
    const primaryFeeds = await Promise.all(SOURCES[lang].map(fetchRSS));

    let all = primaryFeeds.flat().map(item => ({
      guid: item.guid || item.link,
      title: cleanText(item.title),
      link: item.link,
      pubDate: item.pubDate,
      contentSnippet: cleanText(item.contentSnippet || item.content || ""),
      thumbnail: extractImage(item)
    }));

    all = all
      .filter(n => isGamingNews(n, lang))
      .filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));

    all = removeDuplicates(all);

    log.push(`Noticias locales encontradas: ${all.length}`);

    let final = [];

    for (const days of RANGES[lang]) {
      const filtered = all.filter(n => isRecent(n, days));
      if (filtered.length >= TOTAL) {
        final = filtered;
        log.push(`Rango aplicado: ${days} días`);
        break;
      }
    }

    if (final.length < TOTAL) {
      final = [...final, ...all];
    }

    if (final.length < TOTAL && SOURCES_ALT[lang].length > 0) {
      log.push("Usando fuentes alternativas…");

      const altFeeds = await Promise.all(SOURCES_ALT[lang].map(fetchRSS));
      let alt = altFeeds.flat().map(item => ({
        guid: item.guid || item.link,
        title: cleanText(item.title),
        link: item.link,
        pubDate: item.pubDate,
        contentSnippet: cleanText(item.contentSnippet || item.content || ""),
        thumbnail: extractImage(item)
      }));

      alt = alt
        .filter(n => isGamingNews(n, lang))
        .filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));

      alt = removeDuplicates(alt);

      all.push(...alt);
      final.push(...alt);
    }

    final = removeDuplicates(final);

    final.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
    final = final.slice(0, TOTAL);

    log.push(`Total final: ${final.length}`);

    const today = new Date().toISOString().split("T")[0];
    fs.writeFileSync(
      `news_${lang}.json`,
      JSON.stringify({ date: today, notices: final }, null, 2)
    );
  } catch (error) {
    console.error(`🚨 Error crítico procesando el idioma ${lang}:`, error.message);
    log.push(`Error crítico en este idioma: ${error.message}`);
  }
}

// ===============================
// MAIN + LOG FINAL
// ===============================
async function main() {
  const log = [];

  for (const lang of Object.keys(SOURCES)) {
    await generateForLang(lang, log);
  }

  fs.writeFileSync("news_log.txt", log.join("\n"));
}

main();