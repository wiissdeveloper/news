import fetch from "node-fetch";
import fs from "fs";

const TOTAL = 12;

// RSS principal (siempre funciona)
const RSS_MAIN = [
  "https://gamerant.com/feed/",
  "https://www.gameinformer.com/rss.xml",
  "https://www.pcgamer.com/rss/"
];

// Idiomas soportados
const LANGS = ["en", "es", "fr", "it", "de", "pt"];

async function fetchRSS(url) {
  const api = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(url)}`;
  const res = await fetch(api);
  const data = await res.json();
  return data.items || [];
}

async function translate(text, lang) {
  if (lang === "en") return text;

  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|${lang}`;
  const res = await fetch(url);
  const data = await res.json();

  return data?.responseData?.translatedText || text;
}

async function generateForLang(lang) {
  let all = [];

  for (const url of RSS_MAIN) {
    const items = await fetchRSS(url);
    all = all.concat(items);
  }

  all = all
    .filter(n => n.thumbnail && n.thumbnail.startsWith("http"))
    .slice(0, TOTAL);

  for (const item of all) {
    item.title = await translate(item.title, lang);
  }

  const today = new Date().toISOString().split("T")[0];

  fs.writeFileSync(
    `news_${lang}.json`,
    JSON.stringify({ date: today, notices: all }, null, 2)
  );
}

async function main() {
  for (const lang of LANGS) {
    console.log("Generating:", lang);
    await generateForLang(lang);
  }
}

main();
