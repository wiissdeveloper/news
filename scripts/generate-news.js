import fetch from "node-fetch";
import fs from "fs";

const TOTAL = 12;

// ===============================
//  FUENTES REALES POR IDIOMA
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
//  CARGAR RSS CON FALLBACK
// ===============================
async function fetchRSS(url) {
  try {
    const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
    const res = await fetch(api);
    const data = await res.json();
    return data.items || [];
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

    // Si una fuente falla → continúa sin romper
    if (!items || items.length === 0) continue;

    all = all.concat(items);
  }

  // Filtrar solo noticias con imagen válida
  all = all.filter(n => n.thumbnail && n.thumbnail.startsWith("http"));

  // Si hay menos de 12 → fallback a inglés
  if (all.length < TOTAL && lang !== "en") {
    const fallback = await generateFallback();
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
//  FALLBACK A INGLÉS SI FALTAN NOTICIAS
// ===============================
async function generateFallback() {
  let fallback = [];

  for (const url of SOURCES["en"]) {
    const items = await fetchRSS(url);
    fallback = fallback.concat(items);
  }

  return fallback.filter(n => n.thumbnail && n.thumbnail.startsWith("http"));
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
