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
const TIMEOUT_MS = 3000; // Timeout agresivo para no bloquear el script

const RANGES = {
  es: [30, 60, 120], fr: [30, 60, 120], it: [30, 60, 120, 180], 
  de: [30, 60, 120], pt: [30, 60, 120], en: [30, 60, 120]
};

const SOURCES = {
  es: ["https://vandal.elespanol.com/xml.cgi", "https://www.3djuegos.com/rss/rss.xml", "https://as.com/rss/meristation/portada.xml", "https://www.hobbyconsolas.com/rss", "https://areajugones.sport.es/feed/", "https://www.vidaextra.com/feed"],
  it: ["https://www.everyeye.it/feed/feed_rss.asp", "https://multiplayer.it/notizie.xml", "https://www.spaziogames.it/feed/", "https://www.ilvideogioco.com/feed/", "https://www.player.it/feed/", "https://www.gamesvillage.it/feed/", "https://www.tomshw.it/videogioco/feed/", "https://www.gamesource.it/feed/"],
  fr: ["https://www.jeuxvideo.com/rss/rss.xml", "https://www.gamekult.com/feed.xml", "https://www.actugaming.net/feed/", "https://www.jeuxactu.com/rss/", "https://www.gameblog.fr/rss"],
  en: ["https://gamerant.com/feed/", "https://www.gameinformer.com/rss.xml", "https://www.pcgamer.com/rss/"]
};

// --- PALABRAS CLAVE ---
const GAMER_KEYWORDS = ["game", "gaming", "videojuego", "juego", "ps5", "xbox", "nintendo", "switch", "pc", "trailer", "review", "análisis", "launch", "lanzamiento", "rpg", "fps"];
const MOVIE_KEYWORDS = ["película", "pelicula", "movie", "cine", "actor", "director"];
const ANIME_KEYWORDS = ["anime", "manga", "one piece", "dragon ball", "naruto"];
const SERIES_KEYWORDS = ["season", "episode", "serie", "series", "temporada", "netflix", "hbo"];

// --- FUNCIONES AUXILIARES ---
function cleanText(str) {
  if (!str) return "";
  return str.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function isGamingNews(item) {
  const text = `${item.title} ${item.contentSnippet || ""}`.toLowerCase();
  const isGame = GAMER_KEYWORDS.some(k => text.includes(k));
  const isMovie = MOVIE_KEYWORDS.some(k => text.includes(k));
  const isAnime = ANIME_KEYWORDS.some(k => text.includes(k));
  const isSeries = SERIES_KEYWORDS.some(k => text.includes(k));
  return isGame && !isMovie && !isAnime && !isSeries;
}

function extractImage(item) {
  return item.thumbnail?.url || item.mediaContent?.url || item.enclosure?.url || item.content?.match(/src="([^"]+)"/)?.[1];
}

async function fetchXML(url) {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const res = await fetch(proxyUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" },
      signal: controller.signal
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const feed = await parser.parseString(data.contents);
    console.log(`✅ OK: ${url}`);
    return (feed.items || []).slice(0, MAX_ITEMS_PER_FEED);
  } catch (err) {
    console.log(`❌ ERROR: ${url} -> ${err.message}`);
    return [];
  }
}

// --- GENERADOR ---
async function generate() {
  const log = [];
  for (const lang of Object.keys(SOURCES)) {
    console.log(`\n=== PROCESANDO ${lang.toUpperCase()} ===`);
    log.push(`\n=== ${lang.toUpperCase()} ===`);
    
    const feeds = await Promise.all(SOURCES[lang].map(fetchXML));
    let all = feeds.flat().map(i => ({
      title: cleanText(i.title), link: i.link, pubDate: i.pubDate, 
      contentSnippet: cleanText(i.contentSnippet), thumbnail: extractImage(i)
    }));

    all = all.filter(isGamingNews).filter(n => n.thumbnail?.startsWith("http"));
    
    // Relleno de fallback inglés
    if (all.length < TOTAL && lang !== 'en') {
      console.log(`⚠️ Fallback activo para ${lang}`);
      const fallback = await fetchXML(SOURCES['en'][0]);
      all.push(...fallback.filter(isGamingNews));
    }

    const final = Array.from(new Set(all.map(n => n.link)))
      .map(link => all.find(n => n.link === link))
      .sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))
      .slice(0, TOTAL);

    fs.writeFileSync(`news_${lang}.json`, JSON.stringify({ date: new Date(), notices: final }, null, 2));
    log.push(`Total: ${final.length}`);
    fs.writeFileSync("news_log.txt", log.join("\n"));
  }
}

generate();