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
    "https://www.spaziogames.it/feed/"
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
//  EXTRAER IMAGEN REAL (CORREGIDO)
// ===============================
function extractImage(item) {
  // rss-parser puede devolver objetos, arrays o strings
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
    // Buscar imagen dentro del contenido HTML
    (item.content?.match(/<img[^>]+src="([^">]+)"/)?.[1] ?? null)
  );
}

// ===============================
async function fetchRSS(url) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items || [];
  } catch {
    return [];
  }
}

// ===============================
async function generateForLang(lang) {
  let all = [];

  for (const url of SOURCES[lang]) {
    const items = await fetchRSS(url);
    if (!items || items.length === 0) continue;

    const mapped = items.map(item => ({
      guid: item.guid || item.link,
      title: item.title,
      link: item.link,
      pubDate: item.pubDate,
      thumbnail: extractImage(item)
    }));

    all = all.concat(mapped);
  }

  // ===============================
  // FILTRO CORREGIDO (NO PETA)
  // ===============================
  all = all.filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));

  // Fallback si faltan noticias
  if (all.length < TOTAL && lang !== "en") {
    let fallback = [];

    for (const url of SOURCES["en"]) {
      const items = await fetchRSS(url);
      const mapped = items.map(item => ({
        guid: item.guid || item.link,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        thumbnail: extractImage(item)
      }));
      fallback = fallback.concat(mapped);
    }

    fallback = fallback.filter(n => typeof n.thumbnail === "string" && n.thumbnail.startsWith("http"));
    all = all.concat(fallback);
  }

  all = all.slice(0, TOTAL);

  const today = new Date().toISOString().split("T")[0];

  fs.writeFileSync(
    `news_${lang}.json`,
    JSON.stringify({ date: today, notices: all }, null, 2)
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
