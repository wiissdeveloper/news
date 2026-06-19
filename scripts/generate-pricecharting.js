import fs from "fs";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";

// ===============================
//  CONFIG
// ===============================
const USD_TO_EUR = 0.92;
const MAX_RETRIES = 3;
const TIMEOUT_MS = 10000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getRandomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1) + min);

const SYSTEMS = {
  '3do': 'Panasonic 3DO', 'amiga': 'Amiga', 'arcade': 'Arcade', 'atari2600': 'Atari 2600',
  'atari7800': 'Atari 7800', 'atari800': 'Atari 800', 'atarilynx': 'Atari Lynx', 'atarijaguar': 'Atari Jaguar',
  'atomiswave': 'Atomiswave', 'dreamcast': 'Sega Dreamcast', 'fds': 'Famicom Disk System', 'famicom': 'Famicom',
  'gb': 'Game Boy', 'gba': 'Game Boy Advance', 'gbc': 'Game Boy Color', 'gamegear': 'Sega Game Gear',
  'genesis': 'Sega Genesis', 'genh': 'Genesis Hacks', 'gw': 'Game & Watch', 'mastersystem': 'Master System',
  'megadrive': 'Sega Mega Drive', 'n64': 'Nintendo 64', 'naomi': 'Sega Naomi', 'nds': 'Nintendo DS',
  'neogeo': 'Neo Geo AES', 'nes': 'Nintendo NES', 'nesh': 'NES Hacks', 'ngp': 'Neo Geo Pocket',
  'ngpc': 'Neo Geo Pocket Color', 'pcengine': 'PC Engine', 'pcfx': 'PC-FX', 'psx': 'PlayStation',
  'ps2': 'PlayStation 2', 'psp': 'PSP', 'sega32x': 'Sega 32X', 'sfc': 'Super Famicom',
  'sg-1000': 'Sega SG-1000', 'snes': 'Super Nintendo', 'tg16': 'TurboGrafx-16', 'vectrex': 'Vectrex',
  'virtualboy': 'Virtual Boy', 'wonderswan': 'WonderSwan', 'wonderswancolor': 'WonderSwan Color', 'zxspectrum': 'ZX Spectrum'
};

const MAP = {
  "3do": "3do", "amiga": "amiga", "atari-2600": "atari2600", "atari-7800": "atari7800",
  "atari-lynx": "atarilynx", "dreamcast": "dreamcast", "famicom-disk-system": "fds",
  "game-boy": "gb", "game-boy-color": "gbc", "game-boy-advance": "gba", "game-gear": "gamegear",
  "genesis": "genesis", "mega-drive": "megadrive", "master-system": "mastersystem",
  "n64": "n64", "nintendo-ds": "nds", "neo-geo-aes": "neogeo", "nes": "nes",
  "pc-engine": "pcengine", "playstation": "psx", "playstation-2": "ps2",
  "playstation-portable": "psp", "super-nintendo": "snes", "zx-spectrum": "zxspectrum",
  "atari-400": "atari800", "jaguar": "atarijaguar", "famicom": "famicom", "game-&-watch": "gw",
  "comic-books-naomi": "naomi", "pal-neo-geo-pocket-color": "ngpc", "pal-neo-geo-pocket-color-systems": "ngp",
  "pc-fx": "pcfx", "pal-mega-drive-32x": "sega32x", "super-famicom": "sfc", "sg-1000-search": "sg-1000",
  "tg16-card": "tg16", "pal-vectrex": "vectrex", "virtual-boy": "virtualboy", "wonderswan": "wonderswan",
  "wonderswan-color": "wonderswancolor"
};

const PRICECHARTING_URLS = {
  "3do": "https://www.pricecharting.com/console/3do?sort=highest-price",
  "atari-2600": "https://www.pricecharting.com/console/atari-2600?sort=highest-price",
  "atari-7800": "https://www.pricecharting.com/console/atari-7800?sort=highest-price",
  "atari-lynx": "https://www.pricecharting.com/console/atari-lynx?sort=highest-price",
  "dreamcast": "https://www.pricecharting.com/console/sega-dreamcast?sort=highest-price",
  "famicom-disk-system": "https://www.pricecharting.com/console/famicom-disk-system?sort=highest-price",
  "game-boy": "https://www.pricecharting.com/console/gameboy?sort=highest-price",
  "game-boy-color": "https://www.pricecharting.com/console/gameboy-color?sort=highest-price",
  "game-boy-advance": "https://www.pricecharting.com/console/gameboy-advance?sort=highest-price",
  "game-gear": "https://www.pricecharting.com/console/sega-game-gear?sort=highest-price",
  "genesis": "https://www.pricecharting.com/console/sega-genesis?sort=highest-price",
  "mega-drive": "https://www.pricecharting.com/console/pal-sega-mega-drive?sort=highest-price",
  "master-system": "https://www.pricecharting.com/console/sega-master-system?sort=highest-price",
  "n64": "https://www.pricecharting.com/console/pal-nintendo-64?sort=highest-price",
  "nintendo-ds": "https://www.pricecharting.com/console/nintendo-ds?sort=highest-price",
  "neo-geo-aes": "https://www.pricecharting.com/console/neo-geo-aes?sort=highest-price",
  "nes": "https://www.pricecharting.com/console/nes?sort=highest-price",
  "pc-engine": "https://www.pricecharting.com/console/jp-pc-engine?sort=highest-price",
  "playstation": "https://www.pricecharting.com/console/playstation?sort=highest-price",
  "playstation-2": "https://www.pricecharting.com/console/playstation-2?sort=highest-price",
  "playstation-portable": "https://www.pricecharting.com/console/psp?sort=highest-price",
  "super-nintendo": "https://www.pricecharting.com/console/pal-super-nintendo?sort=highest-price",
  "zx-spectrum": "https://www.pricecharting.com/console/zx-spectrum?sort=highest-price",
  "atari-400": "https://www.pricecharting.com/console/atari-400?sort=highest-price",
  "jaguar": "https://www.pricecharting.com/console/jaguar?sort=highest-price",
  "famicom": "https://www.pricecharting.com/console/famicom?sort=highest-price",
  "pal-neo-geo-pocket-color": "https://www.pricecharting.com/console/pal-neo-geo-pocket-color?sort=highest-price",
  "pc-fx": "https://www.pricecharting.com/console/pc-fx?sort=highest-price",
  "pal-mega-drive-32x": "https://www.pricecharting.com/console/pal-mega-drive-32x?sort=highest-price",
  "super-famicom": "https://www.pricecharting.com/console/super-famicom?sort=highest-price",
  "pal-vectrex": "https://www.pricecharting.com/console/pal-vectrex?sort=highest-price",
  "virtual-boy": "https://www.pricecharting.com/console/virtual-boy?sort=highest-price",
  "wonderswan": "https://www.pricecharting.com/console/wonderswan?sort=highest-price",
  "wonderswan-color": "https://www.pricecharting.com/console/wonderswan-color?sort=highest-price"
};

async function fetchHTML(url) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === MAX_RETRIES) return null;
      await sleep(5000 * attempt);
    }
  }
}

function parseTable(html) {
  const dom = new JSDOM(html);
  const table = dom.window.document.querySelector("table#games_table");
  if (!table) return [];
  return [...table.querySelectorAll("tbody tr")].slice(0, 20).map((row, i) => {
    const cols = row.querySelectorAll("td");
    if (cols.length < 3) return null;
    const price = Number(cols[2]?.textContent.replace(/[^0-9.]/g, "")) || 0;
    return { rank: i + 1, name: cols[1]?.textContent.trim(), price_usd: price, price_eur: Math.round(price * USD_TO_EUR) };
  }).filter(Boolean);
}

async function main() {
  const result = {};
  // Inicializar TODOS los sistemas en el resultado
  for (const id of Object.keys(SYSTEMS)) result[id] = [];

  // Procesar solo los que tienen URL configurada
  for (const [key, url] of Object.entries(PRICECHARTING_URLS)) {
    const systemId = MAP[key];
    if (systemId && SYSTEMS[systemId]) {
      console.log(`Scraping: ${SYSTEMS[systemId]}...`);
      const html = await fetchHTML(url);
      if (html) result[systemId] = parseTable(html);
      await sleep(getRandomDelay(2000, 5000));
    }
  }

  fs.writeFileSync('prices.json', JSON.stringify({ updated: new Date().toISOString().split("T")[0], systems: result }, null, 2));
  console.log("¡Hecho! prices.json generado.");
}

main();