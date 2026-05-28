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
//  EXTRAER IMAGEN REAL
// ===============================
function extractImage(item) {
  if (item.thumbnail?.url) return item.thumbnail.url;
  if (item.thumbnail) return item.thumbnail;
  if (item.mediaContent?.url) return item.mediaContent.url;
  if (item.enclosure?.url) return item.enclosure.url;

  // Buscar imagen dentro del contenido HTML
  const match = item.content?.match(/<img[^>]+src="([^">]+)"/);
  if (match) return match[1];

  return null;
}

// ===============================
//  CARGAR RSS SIN TRADUCCIONES
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
//  GENERAR NOTICIAS POR IDIOMA
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

  // Filtrar solo con imagen válida
  all = all.filter(n => n.thumbnail && n.thumbnail.startsWith("http"));

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
    fallback = fallback.filter(n => n.thumbnail && n.thumbnail.startsWith("http"));
    all = all.concat(fallback);
  }

  // Cortar a 12
  all = all.slice(0, TOTAL);

  const today = new Date().toISOString().split("T")[0];

  fs.writeFileSync(
    `news_${lang}.json`,
    JSON.stringify({ date: today, notices: all }, null, 2)
  );
}

// ===============================
//  EJECUCIÓN PRINCIPAL
// ===============================
async function main() {
  for (const lang of Object.keys(SOURCES)) {
    console.log("Generating:", lang);
    await generateForLang(lang);
  }
}

main();
