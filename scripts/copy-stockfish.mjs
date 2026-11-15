// Stockfish "lite, tek iş parçacıklı" motor dosyalarını public/stockfish klasörüne kopyalar.
import { copyFileSync, mkdirSync } from 'node:fs';

const FILES = ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm'];

mkdirSync('public/stockfish', { recursive: true });
for (const file of FILES) {
  copyFileSync(`node_modules/stockfish/bin/${file}`, `public/stockfish/${file}`);
}
console.log('Stockfish dosyaları public/stockfish klasörüne kopyalandı.');
