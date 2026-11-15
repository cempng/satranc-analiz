// lichess-org/chess-openings TSV dosyalarından (CC0) public/openings.json üretir.
// Çıktı: { "<EPD>": "ECO|Açılış adı" }. Bir açılış satırının ara pozisyonları da kitap sayılır;
// kendi adı olmayan ara pozisyonlarda değer boş dizedir.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { Chess } from 'chess.js';

const dir = 'data/openings';
const book = {};

for (const file of readdirSync(dir).filter((f) => f.endsWith('.tsv')).sort()) {
  const rows = readFileSync(`${dir}/${file}`, 'utf8').trim().split('\n').slice(1);
  for (const row of rows) {
    const [eco, name, pgn] = row.split('\t');
    const chess = new Chess();
    const sans = pgn.replace(/\d+\.(\.\.)?/g, ' ').trim().split(/\s+/);
    sans.forEach((san, i) => {
      chess.move(san);
      const epd = chess.fen().split(' ').slice(0, 4).join(' ');
      if (i === sans.length - 1) book[epd] = `${eco}|${name}`;
      else book[epd] ??= '';
    });
  }
}

writeFileSync('public/openings.json', JSON.stringify(book));
console.log(`${Object.keys(book).length} kitap pozisyonu yazıldı.`);
