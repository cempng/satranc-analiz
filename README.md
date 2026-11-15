# Satranç Analiz

Tarayıcıda çalışan, sunucu gerektirmeyen bir satranç oyun analiz uygulaması. Bir PGN yapıştırırsın ya da yüklersin; uygulama oyunu Stockfish ile hamle hamle analiz eder, her hamleyi sınıflandırır (Brillant, Harika, En İyi, Mükemmel, İyi, Kitap, Belirsiz, Hata, Büyük Hata, Kaçırılan Fırsat, Zorunlu), Türkçe yorum üretir ve oyun özeti gösterir.

## Kurulum

Gereken: [Node.js](https://nodejs.org) 20.19 veya üstü.

```bash
npm install
```

`npm install` sonunda Stockfish motor dosyaları otomatik olarak `public/stockfish/` klasörüne kopyalanır.

## Çalıştırma

```bash
npm run dev
```

Sonra tarayıcıda `http://localhost:5173` adresini aç.

| Komut | Ne yapar |
| --- | --- |
| `npm run dev` | Geliştirme sunucusunu başlatır |
| `npm run build` | Tür denetimi yapar ve `dist/` klasörüne yayın sürümünü üretir |
| `npm run preview` | Üretilen yayın sürümünü yerelde açar |
| `npm test` | Birim testlerini (Vitest) çalıştırır |
| `npm run openings` | `data/openings/*.tsv` dosyalarından `public/openings.json` açılış kitabını yeniden üretir |

`dist/` klasörü herhangi bir statik sunucuda (GitHub Pages, Netlify vb.) özel başlık gerekmeden çalışır.

## Kullanım

- **PGN yükleme:** metin kutusuna yapıştır, `.pgn` dosyası seç ya da sürükle-bırak. Dosyada birden çok oyun varsa listeden seç. `[FEN]` etiketi desteklenir. Hatalı hamlede hangi hamlede sorun olduğu Türkçe yazılır.
- **Gezinme:** ← / → bir hamle, Home / End başa / sona, F tahtayı çevir. Hamle listesine, grafiğe ya da kritik anlara tıklayarak da gidebilirsin.
- **Analiz:** oyun yüklenince otomatik başlar. Derinlik: Hızlı 12 / Normal 16 / Derin 20. Sonuçlar tarayıcıda saklanır; aynı oyunu tekrar açınca anında gelir.
- **Varyant:** tahtada bir taşı sürükleyerek farklı bir hamle dene; motor yeni pozisyonu analiz eder. “Ana hatta dön” ile oyuna geri dön.
- **Koç yorumu (isteğe bağlı):** Ayarlar’a bir Anthropic API anahtarı girersen her hamle için Claude’dan doğal dilde yorum alabilirsin. Anahtar yalnızca tarayıcında saklanır ve yalnızca Anthropic’e gönderilir; her istek hesabından ücretlendirilir.

## Mimari

Her şey istemci tarafında çalışır. Stockfish bir Web Worker içinde, ana arayüzü dondurmadan çalışır.

```
PGN metni ──► lib/pgn.ts (ayrıştırma, hata mesajları)
                 │
                 ▼
          store/gameStore.ts (oyun, gezinme, varyant)
                 │
                 ▼
  store/analysisStore.ts ──► engine/stockfish.ts ──► Web Worker (public/stockfish/*)
     │        ▲                    (UCI, MultiPV 3, beyaz perspektifi)
     │        └── engine/analysisCache.ts (localStorage)
     ▼
  analysis/classifyGame.ts ──► classify.ts, sacrifice.ts, openings.ts, winPct.ts
     │
     ├──► analysis/comments.ts + tactics.ts (Türkçe yorumlar)
     ├──► analysis/summary.ts + accuracy.ts (doğruluk, kritik anlar)
     └──► analysis/coach.ts (isteğe bağlı Claude koç yorumu)
                 │
                 ▼
          components/* (tahta, eval bar, grafik, paneller)
```

### Klasörler

| Klasör | İçerik |
| --- | --- |
| `src/engine` | Stockfish Web Worker sarmalayıcısı (`stockfish.ts`), UCI ayrıştırma ve skor dönüşümü (`uci.ts`), canlı analiz kancası, önbellek |
| `src/analysis` | Saf fonksiyonlar: Win% (`winPct.ts`), sınıflandırma (`classify.ts`), feda tespiti, doğruluk, taktik tespitleri, yorumlar, özet; **tüm eşikler `config.ts` içinde** |
| `src/components` | React bileşenleri |
| `src/store` | Zustand depoları: oyun/gezinme/varyant, motor, tam-oyun analizi, ayarlar |
| `src/lib` | PGN ayrıştırma ve Türkçe notasyon |
| `scripts` | Stockfish dosyalarını kopyalama ve açılış kitabını üretme betikleri |
| `data/openings` | lichess açılış veritabanı (TSV kaynak dosyaları) |

### Analiz kuralları (özet)

- **Win%** = 50 + 50 · (2 / (1 + e^(−0.00368208 · cp)) − 1), cp ±1000 ile sınırlı; matta kazanan 100, kaybeden 0. Motor skorları sırası gelen tarafa göredir; hepsi beyaz perspektifine çevrilir.
- **Kayıp** = max(0, hamleden önceki Win% − hamleden sonraki Win%), hamleyi yapan taraf açısından.
- **Sınıflar** sırasıyla kontrol edilir: Zorunlu (tek yasal hamle) → Kitap → Brillant → Harika → Kaçırılan Fırsat → En İyi → kayba göre Mükemmel (<2) / İyi (<5) / Belirsiz (<10) / Hata (<20) / Büyük Hata.
- **Doğruluk** = 103.1668 · e^(−0.04354 · kayıp) − 3.1669 (0–100); oyuncu doğruluğu aritmetik ve harmonik ortalamanın ortalamasıdır. Zorunlu hamleler sayılmaz.

Ayrıntılar ve tüm eşikler: [`src/analysis/config.ts`](src/analysis/config.ts).

## Testler

```bash
npm test
```

Win%, perspektif dönüşümü, mat skorları, sınıflandırma eşikleri, feda tespiti, doğruluk, taktik tespitleri, Türkçe yorumlar, PGN ayrıştırma, varyant modu ve önbellek için birim testleri vardır.

## Lisanslar ve kaynaklar

- **Stockfish** ([stockfish.js](https://github.com/nmrugg/stockfish.js), lite tek iş parçacıklı sürüm) GPL-3.0 lisanslıdır. Uygulamayı dağıtırsan Stockfish’in kaynak koduna erişim sağlaman gerekir.
- **Açılış veritabanı:** [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0 (kamu malı).
- İkonlar ve renkler bu proje için çizilmiştir.
