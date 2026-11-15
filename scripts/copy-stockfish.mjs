// Stockfish tek iş parçacıklı motor dosyalarını public/stockfish klasörüne kopyalar:
// "lite" (~1.8 MB, varsayılan) ve "tam" (~100 MB, Ayarlar'dan seçilebilir).
import { copyFileSync, mkdirSync } from 'node:fs';

const FILES = [
  'stockfish-19-lite-single.js',
  'stockfish-19-lite-single.wasm',
  'stockfish-19-single.js',
  'stockfish-19-single.wasm',
];

mkdirSync('public/stockfish', { recursive: true });
for (const file of FILES) {
  copyFileSync(`node_modules/stockfish/bin/${file}`, `public/stockfish/${file}`);
}
console.log('Stockfish dosyaları public/stockfish klasörüne kopyalandı.');
