import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

// ===============================
//  CONFIG
// ===============================

// Conversión USD → EUR (puedes actualizarlo 1 vez al mes)
const USD_TO_EUR = 0.92;

// Reintentos y timeout
const MAX_RETRIES = 3;
const TIMEOUT_MS = 8000;

// Tus sistemas (frontend)
const SYSTEMS = {
  '3do': 'Panasonic 3DO',
  'amiga': 'Amiga',
  'arcade': 'Arcade',
  'atari2600': 'Atari 2600',
  'atari7800': 'Atari 7800',
  'atari800': 'Atari 800',
  'atarilynx': 'Atari Lynx',
  'dreamcast': 'Sega Dreamcast',
  'fds': 'Famicom Disk System',
  'gb': 'Game Boy',
  'gba': 'Game Boy Advance',
  'gbc': 'Game Boy Color',
  'gamegear': 'Sega Game Gear',
  'genesis': 'Sega Genesis',
  'mame': 'MAME Arcade',
  'mastersystem': 'Master System',
  'megadrive': 'Sega Mega Drive',
  'n64': 'Nintendo 64',
  'nds': 'Nintendo DS',
  'neogeo': 'Neo Geo AES',
  'nes': 'Nintendo NES',
  'pcengine': 'PC Engine',
  'psx': 'PlayStation',
  'ps2': 'PlayStation 2',
  'psp': 'PSP',
  'snes': 'Super Nintendo',
  'zxspectrum': 'ZX Spectrum'
};

// ===============================
//  MAPEOS PriceCharting → tus IDs
// ===============================
const MAP = {
  "3do": "3do",
  "amiga": "amiga",
  "atari-2600": "atari2600",
  "atari-7800": "atari7800",
  "atari-lynx": "atarilynx",
  "dreamcast": "dreamcast",
  "famicom-disk-system": "fds",
  "game-boy": "gb",
  "game-boy-color": "gbc",
  "game-boy-advance": "gba",
  "game-gear": "gamegear",
  "genesis": "genesis",
  "mega-drive": "megadrive",
  "master-system": "mastersystem",
  "n64": "n64",
  "nintendo-ds": "nds",
  "neo-geo-aes": "neogeo",
  "nes": "nes",
  "pc-engine": "pcengine",
  "playstation": "psx",
  "playstation-2": "ps2",
  "playstation-portable": "psp",
  "super-nintendo": "snes",
  "zx-spectrum": "zxspectrum"
};

// ===============================
//  TODAS LAS URLs REALES
// ===============================
const PRICECHARTING_URLS = {
  "3do": "https://www.pricecharting.com/console/3do?sort=highest-price",
  "amiga": "https://www.pricecharting.com/console/amiga?sort=highest-price",
  "atari-2600": "https://www.pricecharting.com/console/atari-2600?sort=highest-price",
  "atari-7800": "https://www.pricecharting.com/console/atari-7800?sort=highest-price",
  "atari-lynx": "https://www.pricecharting.com/console/atari-lynx?sort=highest-price",
  "dreamcast": "https://www.pricecharting.com/console/dreamcast?sort=highest-price",
  "famicom-disk-system": "https://www.pricecharting.com/console/famicom-disk-system?sort=highest-price",
  "game-boy": "https://www.pricecharting.com/console/game-boy?sort=highest-price",
  "game-boy-color": "https://www.pricecharting.com/console/game-boy-color?sort=highest-price",
  "game-boy-advance": "https://www.pricecharting.com/console/game-boy-advance?sort=highest-price",
  "game-gear": "https://www.pricecharting.com/console/game-gear?sort=highest-price",
  "genesis": "https://www.pricecharting.com/console/genesis?sort=highest-price",
  "mega-drive": "https://www.pricecharting.com/console/mega-drive?sort=highest-price",
  "master-system": "https://www.pricecharting.com/console/master-system?sort=highest-price",
  "n64": "https://www.pricecharting.com/console/n64?sort=highest-price",
  "nintendo-ds": "https://www.pricecharting.com/console/nintendo-ds?sort=highest-price",
  "neo-geo-aes": "https://www.pricecharting.com/console/neo-geo-aes?sort=highest-price",
  "nes": "https://www.pricecharting.com/console/nes?sort=highest-price",
  "pc-engine": "https://www.pricecharting.com/console/pc-engine?sort=highest-price",
  "playstation": "https://www.pricecharting.com/console/playstation?sort=highest-price",
  "playstation-2": "https://www.pricecharting.com/console/playstation-2?sort=highest-price",
  "playstation-portable": "https://www.pricecharting.com/console/playstation-portable?sort=highest-price",
  "super-nintendo": "https://www.pricecharting.com/console/super-nintendo?sort=highest-price",
  "zx-spectrum": "https://www.pricecharting.com/console/zx-spectrum?sort=highest-price"
};

// ===============================
//  FETCH HTML CON REINTENTOS
// ===============================
async function fetchHTML(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"
        },
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!res.ok) throw new Error("HTTP " + res.status);

      return await res.text();
    } catch (err) {
      console.log(`Error en ${url} (intento ${attempt})`);
      if (attempt === MAX_RETRIES) return null;
    }
  }
}

// ===============================
//  PARSEAR TABLA
// ===============================
function parsePrice(str) {
  if (!str) return 0;
  return Number(str.replace(/[^0-9.]/g, "")) || 0;
}

function parseTable(html) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const rows = [...doc.querySelectorAll("table#games_table tbody tr")];

  return rows.slice(0, 20).map((row, i) => {
    const cols = row.querySelectorAll("td");

    const price_usd = parsePrice(cols[2]?.textContent);

    return {
      rank: i + 1,
      name: cols[1]?.textContent.trim() || "",
      price_usd,
      price_eur: Math.round(price_usd * USD_TO_EUR)
    };
  });
}

// ===============================
//  MAIN
// ===============================
async function main() {
  const result = {};

  // Inicializar todas las consolas vacías
  for (const id of Object.keys(SYSTEMS)) {
    result[id] = [];
  }

  // Scrapeo real
  for (const [pcID, url] of Object.entries(PRICECHARTING_URLS)) {
    const mapped = MAP[pcID];
    if (!mapped) continue;

    console.log("Scraping:", mapped);

    const html = await fetchHTML(url);
    if (!html) {
      result[mapped] = [];
      continue;
    }

    result[mapped] = parseTable(html);
  }

  const today = new Date().toISOString().split("T")[0];

  fs.writeFileSync(
    `prices.json`,
    JSON.stringify({
      updated: today,
      source: "https://www.pricecharting.com",
      systems: result
    }, null, 2)
  );

  console.log("prices.json generado correctamente");
}

main();
