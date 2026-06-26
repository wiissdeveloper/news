import Parser from "rss-parser";
import fs from "fs";

const parser = new Parser({
  customFields: { item: [["media:thumbnail", "thumbnail"], ["media:content", "mediaContent"], ["enclosure", "enclosure"]] }
});

const TOTAL = 12;
const SOURCES = {
  es: ["https://vandal.elespanol.com/xml.cgi", "https://www.3djuegos.com/rss/rss.xml", "https://as.com/rss/meristation/portada.xml", "https://www.hobbyconsolas.com/rss", "https://areajugones.sport.es/feed/", "https://www.vidaextra.com/feed"],
  it: ["https://www.everyeye.it/feed/feed_rss.asp", "https://multiplayer.it/notizie.xml", "https://www.spaziogames.it/feed/", "https://www.ilvideogioco.com/feed/", "https://www.player.it/feed/", "https://www.gamesvillage.it/feed/", "https://www.tomshw.it/videogioco/feed/", "https://www.gamesource.it/feed/"],
  fr: ["https://www.jeuxvideo.com/rss/rss.xml", "https://www.gamekult.com/feed.xml", "https://www.actugaming.net/feed/", "https://www.jeuxactu.com/rss/", "https://www.gameblog.fr/rss"],
  en: ["https://gamerant.com/feed/", "https://www.gameinformer.com/rss.xml", "https://www.pcgamer.com/rss/"]
};

// --- TUS LISTAS ORIGINALES COMPLETAS ---
const GAMER_KEYWORDS = ["game", "gaming", "videojuego", "video game", "juego", "ps5", "playstation", "ps4", "ps3", "xbox", "series x", "series s", "one", "nintendo", "switch", "zelda", "mario", "pokemon", "steam", "pc gaming", "pc", "trailer", "review", "análisis", "avance", "dlc", "expansión", "update", "actualización", "esports", "torneo", "competitivo", "launch", "release", "lanzamiento", "fps", "rpg", "shooter", "battle royale", "retro", "emulador", "emulación"];
const MOVIE_KEYWORDS = ["película", "pelicula", "movie", "film", "cine", "actor", "actriz", "director", "taquilla", "box office"];
const ANIME_KEYWORDS = ["anime", "manga", "one piece", "dragon ball", "naruto", "bleach", "haki", "luffy", "zoro", "gear 5"];
const SERIES_KEYWORDS = ["season", "episode", "serie", "series", "temporada", "house of the dragon", "netflix", "hbo", "prime video"];
const IT_EXCLUDE = ["politica", "governo", "elezioni", "parlamento", "guerra", "crisi"];

async function fetchXML(url) {
  try {
    // Proxy universal para evitar bloqueos
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
    const res = await fetch(proxyUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36" }
    });
    if (!res.ok) return [];
    const data = await res.json();
    const feed = await parser.parseString(data.contents);
    return feed.items || [];
  } catch (e) {
    return [];
  }
}

function isValid(item, lang) {
  const text = `${item.title} ${item.contentSnippet || ""}`.toLowerCase();
  const isGame = GAMER_KEYWORDS.some(k => text.includes(k));
  const isMovie = MOVIE_KEYWORDS.some(k => text.includes(k));
  const isAnime = ANIME_KEYWORDS.some(k => text.includes(k));
  const isSeries = SERIES_KEYWORDS.some(k => text.includes(k));
  const isItBad = lang === 'it' && IT_EXCLUDE.some(k => text.includes(k));

  return isGame && !isMovie && !isAnime && !isSeries && !isItBad;
}

async function generate() {
  for (const lang of Object.keys(SOURCES)) {
    let allNews = [];
    for (const url of SOURCES[lang]) {
      const items = await fetchXML(url);
      allNews.push(...items.map(i => ({
        ...i,
        pubDate: new Date(i.pubDate || Date.now()),
        thumbnail: i.thumbnail?.url || i.enclosure?.url || i.content?.match(/src="([^"]+)"/)?.[1]
      })));
    }

    let final = allNews
      .filter(n => isValid(n, lang) && n.thumbnail?.startsWith("http"))
      .sort((a, b) => b.pubDate - a.pubDate);
    
    // Relleno de emergencia con noticias globales (Inglés) si falta contenido
    if (final.length < TOTAL && lang !== 'en') {
      const fallback = await fetchXML(SOURCES['en'][0]);
      final.push(...fallback.filter(n => isValid(n, 'en')).slice(0, TOTAL - final.length));
    }

    final = Array.from(new Set(final.map(n => n.link))).map(link => final.find(n => n.link === link)).slice(0, TOTAL);
    fs.writeFileSync(`news_${lang}.json`, JSON.stringify({ date: new Date(), notices: final }, null, 2));
  }
}

generate();