// Export data/phrases.json as an Anki-importable CSV (front, back, tags).
// Usage: node scripts/to-anki-csv.mjs > anki-phrases.csv
import { readFileSync } from "node:fs";

const phrases = JSON.parse(readFileSync(new URL("../data/phrases.json", import.meta.url), "utf8"));
const esc = (s) => `"${String(s).replaceAll('"', '""')}"`;
const tag = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

console.log("#separator:comma");
console.log("#columns:Front,Back,Tags");
for (const p of phrases) {
  console.log([esc(p.pt), esc(p.en), esc(`${tag(p.topic)} ${p.level}`)].join(","));
}
