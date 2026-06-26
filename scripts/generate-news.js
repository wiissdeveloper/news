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
const TIMEOUT_MS = 8000;

const RANGES = {
  es: [30, 60, 120], fr: [30, 60, 120], it: [30, 60, 120, 180],
  de: [30, 60, 120], pt: [30, 60, 120], en: [30, 60, 120]
};

const SOURCES_ALT = {
  it: ["https://www.ilvideogioco.com/feed/", "https://www.gamesource.it/feed/", "https://www.nintendoomed.it/feed/", "https://www.pcgaming.it/feed/"],
  es: ["https://areajugones.sport.es/feed/", "https://www.vidaextra.com/feed"],
  fr: ["https://www.jeuxactu.com/rss/", "https://www.gameblog.fr/rss"],
  de: [], pt: [], en: []
};

const IT_EXCLUDE = ["politica", "governo", "elezioni", "parlamento", "guerra", "crisi"];

async function fetchXML(url, lang) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const targetUrl = lang === 'it' ? `https://api.allorigins.win/get?url=${encodeURIComponent(url)}` : url;
      const res = await fetch(targetUrl, {
        method: "GET",
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
        signal: controller.signal
      });

      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      let xmlData;
      if (lang === 'it') {
        const json = await res.json();
        xmlData = json.contents;
      } else {
        const buffer = Buffer.from(await res.arrayBuffer());
        const xmlDecl = buffer.toString("ascii", 0, 200).match(/encoding="([^"]+)"/i);
        const encoding = xmlDecl ? xmlDecl[1].toLowerCase() : "utf-8";
        xmlData = iconv.decode(buffer, encoding);
      }

      const feed = await parser.parseString(xmlData);
      // MEJORA: Filtramos solo elementos que tengan un enlace válido
      return (feed.items || []).filter(i => i.link).slice(0, MAX_ITEMS_PER_FEED);
    } catch (err) {
      console.log(`Error en ${url} (intento ${attempt}): ${err.message}`);
      if (attempt === MAX_RETRIES) return [];
    }
  }
}

function cleanText(str) {
  if (!str) return "";
  // Limpieza más robusta de entidades HTML
  return str.replace(/&#[0-9]+;/g, '').replace(/&[a-z]+;/g, ' ').trim();
}

// MEJORA: Parseo de fecha seguro (evita que el script se detenga por fechas raras)
function getSafeDate(dateStr) {
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? new Date() : date;
}

const SOURCES = { /* (Tus fuentes igual) */ 
  es: ["https://vandal.elespanol.com/xml.cgi", "https://www.3djuegos.com/rss/rss.xml", "https://as.com/rss/meristation/portada.xml", "https://www.hobbyconsolas.com/rss"],
  fr: ["https://www.jeuxvideo.com/rss/rss.xml", "https://www.gamekult.com/feed.xml", "https://www.actugaming.net/feed/"],
  it: ["https://www.everyeye.it/feed/feed_rss.asp", "https://multiplayer.it/notizie.xml", "https://www.spaziogames.it/feed/", "https://www.ilvideogioco.com/feed/", "https://www.player.it/feed/", "https://www.gamesvillage.it/feed/", "https://www.tomshw.it/videogioco/feed/"],
  de: ["https://www.gamestar.de/news/rss/news.rss", "https://www.pcgames.de/rss/news.xml", "https://mein-mmo.de/feed/"],
  pt: ["https://www.eurogamer.pt/?format=rss", "https://meusjogos.pt/feed/"],
  en: ["https://gamerant.com/feed/", "https://www.gameinformer.com/rss.xml", "https://www.pcgamer.com/rss/"]
};

// Palabras clave (iguales)
const GAMER_KEYWORDS = ["game", "gaming", "videojuego", "video game", "juego", "ps5", "playstation", "ps4", "ps3", "xbox", "series x", "series s", "one", "nintendo", "switch", "zelda", "mario", "pokemon", "steam", "pc gaming", "pc", "trailer", "review", "análisis", "avance", "dlc", "expansión", "update", "actualización", "esports", "torneo", "competitivo", "launch", "release", "lanzamiento", "fps", "rpg", "shooter", "battle royale", "retro", "emulador", "emulación"];
const MOVIE_KEYWORDS = ["película", "pelicula", "movie", "film", "cine", "actor", "actriz", "director", "taquilla", "box office"];
const ANIME_KEYWORDS = ["anime", "manga", "one piece", "dragon ball", "naruto", "bleach", "haki", "luffy", "zoro", "gear 5"];
const SERIES_KEYWORDS = ["season", "episode", "serie", "series", "temporada", "house of the dragon", "netflix", "hbo", "prime video"];

function isGamingNews(item, lang) {
  const text = `${item.title} ${item.contentSnippet || ""}`.toLowerCase();
  const isGame = GAMER_KEYWORDS.some(k => text.includes(k));
  const isExcluded = lang === 'it' && IT_EXCLUDE.some(k => text.includes(k));
  return isGame && !MOVIE_KEYWORDS.some(k => text.includes(k)) && !ANIME_KEYWORDS.some(k => text.includes(k)) && !SERIES_KEYWORDS.some(k => text.includes(k)) && !isExcluded;
}

function isRecent(item, days) {
  const diff = (Date.now() - getSafeDate(item.pubDate).getTime()) / (1000 * 60 * 60 * 24);
  return diff <= days;
}

function extractImage(item) {
  const tryUrl = (v) => { if (!v) return null; if (typeof v === "string") return v; if (v.url) return v.url; if (Array.isArray(v) && v[0]?.url) return v[0].url; return null; };
  return tryUrl(item.thumbnail) || tryUrl(item.mediaContent) || tryUrl(item.enclosure) || (item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ?? null);
}

function removeDuplicates(items) {
  const seen = new Set();
  return items.filter(item => {
    const key = (item.guid || item.link || item.title).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function generateForLang(lang, log) {
  log.push(`\n=== ${lang.toUpperCase()} ===`);
  const fetchRSS = (url) => fetchXML(url, lang);

  const primaryFeeds = await Promise.all(SOURCES[lang].map(fetchRSS));
  // MEJORA: Usar getSafeDate en el mapeo
  let all = primaryFeeds.flat().map(item => ({ 
      guid: item.guid || item.link, 
      title: cleanText(item.title), 
      link: item.link, 
      pubDate: getSafeDate(item.pubDate), 
      contentSnippet: cleanText(item.contentSnippet || item.content || ""), 
      thumbnail: extractImage(item) 
  }));

  all = all.filter(n => isGamingNews(n, lang) && typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));
  all = removeDuplicates(all);

  let final = [];
  for (const days of RANGES[lang]) {
    const filtered = all.filter(n => isRecent(n, days));
    if (filtered.length >= TOTAL) { final = filtered; log.push(`Rango aplicado: ${days} días`); break; }
  }

  // Fuentes alternativas y fallback igual...
  if (final.length < TOTAL && SOURCES_ALT[lang].length > 0) {
    const altFeeds = await Promise.all(SOURCES_ALT[lang].map(fetchRSS));
    let alt = altFeeds.flat().map(item => ({ guid: item.guid || item.link, title: cleanText(item.title), link: item.link, pubDate: getSafeDate(item.pubDate), contentSnippet: cleanText(item.contentSnippet || item.content || ""), thumbnail: extractImage(item) }));
    alt = alt.filter(n => isGamingNews(n, lang) && typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));
    final = removeDuplicates([...final, ...alt]);
  }

  if (final.length < TOTAL && lang !== "en") {
    const fallbackFeeds = await Promise.all(SOURCES["en"].map(fetchRSS));
    let fallback = fallbackFeeds.flat().map(item => ({ guid: item.guid || item.link, title: cleanText(item.title), link: item.link, pubDate: getSafeDate(item.pubDate), contentSnippet: cleanText(item.contentSnippet || item.content || ""), thumbnail: extractImage(item) }));
    fallback = fallback.filter(n => isGamingNews(n, lang) && typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));
    final = removeDuplicates([...final, ...fallback]);
  }

  final.sort((a, b) => b.pubDate - a.pubDate);
  final = final.slice(0, TOTAL);
  
  fs.writeFileSync(`news_${lang}.json`, JSON.stringify({ date: new Date().toISOString().split("T")[0], notices: final }, null, 2));
}

async function main() {
  const log = [];
  for (const lang of Object.keys(SOURCES)) await generateForLang(lang, log);
  fs.writeFileSync("news_log.txt", log.join("\n"));
}

main();