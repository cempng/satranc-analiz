# Satranç Analiz

Tarayıcıda çalışan, sunucu gerektirmeyen bir satranç oyun analiz uygulaması. Bir PGN yapıştırırsın ya da yüklersin; uygulama oyunu Stockfish ile hamle hamle analiz eder, her hamleyi sınıflandırır (Brillant, Harika, En İyi, Mükemmel, İyi, Kitap, Belirsiz, Hata, Büyük Hata, Kaçırılan Fırsat, Zorunlu), Türkçe yorum üretir ve oyun özeti gösterir.

## Kurulum

Gereken: [Node.js](https://nodejs.org) 20.19 veya üstü.

```bash
npm install
```

`npm install` sonunda Stockfish motor dosyaları (lite ve tam) otomatik olarak `public/stockfish/` klasörüne kopyalanır.

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

- **Oyun yükleme:** “Oyun” kutusunda üç yol var:
  - **PGN:** metin kutusuna yapıştır, `.pgn` dosyası seç ya da sürükle-bırak. Dosyada birden çok oyun varsa listeden seç. `[FEN]` etiketi desteklenir; hatalı hamlede hangi hamlede sorun olduğu Türkçe yazılır.
  - **Lichess / Chess.com:** kullanıcı adını yaz, son 20 herkese açık oyun listelenir; birine tıkla. Giriş gerekmez.
- **Gezinme:** ← / → bir hamle, Home / End başa / sona, F tahtayı çevir. Hamle listesine, grafiğe ya da kritik anlara tıklayarak da gidebilirsin.
- **Analiz:** oyun yüklenince otomatik başlar. Derinlik: Hızlı 12 / Normal 16 / Derin 20. Sonuçlar tarayıcıda saklanır; aynı oyunu tekrar açınca anında gelir.
- **Varyant:** tahtada bir taşı sürükleyerek farklı bir hamle dene; motor yeni pozisyonu analiz eder (tam analiz sürüyorsa o sırada duraklar). “Ana hatta dön” ile oyuna geri dön.
- **Hatanı bul:** analiz bitince oyundaki Hata / Büyük Hata / Kaçırılan Fırsat anlarından bulmaca çözersin. İpucu ve çözüm düğmeleri var; motorun ilk 3 hamlesi dışındaki cevaplar motorla ayrıca kontrol edilir.
- **Analizli PGN indir:** sınıflar (!!, !, ?!, ?, ??), `[%eval]` değerlendirmeleri ve kısa yorumlarla PGN dosyası. Lichess, ChessBase gibi programlarda açılabilir.
- **Oyun sonu veritabanı:** 7 veya daha az taş kalınca lichess’in Syzygy veritabanından kesin sonuç ve en iyi hamle gösterilir (Ayarlar’dan kapatılabilir).
- **İstatistik sayfası:** bir kullanıcının son 5–30 oyununu toplu analiz eder: ortalama doğruluk, evrelere göre doğruluk, oyun başına hata sayıları, açılışlara göre puan ve doğruluk.
- **Ayarlar:**
  - **Dil / Language:** Türkçe ya da İngilizce. İlk açılışta tarayıcı diline göre seçilir; notasyon da dile uyar (Türkçe: Ş V K F A, İngilizce: K Q R B N).
  - Tahta teması ve hamle sesleri (isteğe bağlı `public/sounds/*.mp3` dosyaları: `move-self`, `move-opponent`, `capture`, `castle`, `move-check`, `promote`, `game-start`, `game-end`, `illegal`; bu klasör depoya konmaz, dosya yoksa tarayıcıda üretilen yedek sesler çalar).
  - Motor: **lite** (~2 MB, varsayılan) ya da **tam** (~100 MB, daha güçlü ama yavaş yüklenir).
  - **Sınıflandırma eşikleri:** Brillant, Harika, Kaçırılan Fırsat ve kayıp sınırlarını değiştirebilirsin; tüm hamleler anında yeniden sınıflandırılır.
  - **Koç yorumu (isteğe bağlı):** bir Anthropic API anahtarı girersen her hamle için Claude’dan doğal dilde yorum alabilirsin. Anahtar yalnızca tarayıcında saklanır ve yalnızca Anthropic’e gönderilir; her istek hesabından ücretlendirilir.

### Dış servisler

Uygulama sunucu gerektirmez; yalnızca şu durumlarda tarayıcı doğrudan dış servise bağlanır:

| Servis | Ne zaman | Ne gönderilir |
| --- | --- | --- |
| lichess.org / api.chess.com | Kullanıcı adıyla oyun getirirken | Kullanıcı adı |
| tablebase.lichess.ovh | 7 veya daha az taşlı pozisyonda (kapatılabilir) | Pozisyon (FEN) |
| api.anthropic.com | “Koç yorumu al” düğmesine basınca | Pozisyon, hamle, sınıf, motor çizgisi |

## İnternette yayınlama

`vite.config.ts` göreli yol (`base: './'`) kullandığı için `dist/` klasörü herhangi bir adreste çalışır.

**GitHub Pages (otomatik):** `.github/workflows/deploy.yml` hazır. Projeyi bir GitHub deposuna gönderdikten sonra depo ayarlarında *Settings → Pages → Source: GitHub Actions* seç. Bundan sonra `main` dalına her gönderimde testler çalışır, uygulama derlenir ve `https://<kullanıcı-adın>.github.io/<depo-adı>/` adresinde yayınlanır.

**Netlify Drop (ücretsiz hesapla, sürükle-bırak):** `npm run build` çalıştır, oluşan `dist` klasörünü [app.netlify.com/drop](https://app.netlify.com/drop) sayfasına sürükle.

Not: tam motor dosyası (~100 MB) da `dist/stockfish/` içine kopyalanır. Barındırma servisi büyük dosyaya izin vermezse yayından önce `dist/stockfish/stockfish-19-single.*` dosyalarını silebilirsin; bu durumda Ayarlar’da yalnızca lite motor kullanılabilir.

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
| `src/engine` | Stockfish Web Worker sarmalayıcısı (`stockfish.ts`, lite/tam motor seçimi), UCI ayrıştırma ve skor dönüşümü (`uci.ts`), canlı analiz kancası, önbellek |
| `src/analysis` | Saf fonksiyonlar: Win% (`winPct.ts`), sınıflandırma (`classify.ts`), feda tespiti, doğruluk, taktik tespitleri, yorumlar, özet, alıştırma bulmacaları (`practice.ts`), istatistik (`stats.ts`), PGN dışa aktarma (`exportPgn.ts`); **tüm varsayılan eşikler `config.ts` içinde** |
| `src/components` | React bileşenleri |
| `src/store` | Zustand depoları: oyun/gezinme/varyant, motor, tam-oyun analizi, alıştırma, toplu istatistik, ayarlar |
| `src/i18n` | Dil desteği: `tr.ts` ve `en.ts` sözlükleri (İngilizcede eksik anahtar derleme hatası verir), `t()` çevirisi, `useT()` kancası |
| `src/lib` | PGN ayrıştırma, Türkçe notasyon, Lichess/Chess.com istemcisi (`onlineGames.ts`), oyun sonu veritabanı (`tablebase.ts`), hamle sesleri (`sounds.ts`) |
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

Win%, perspektif dönüşümü, mat skorları, sınıflandırma eşikleri (varsayılan ve kullanıcı ayarı), feda tespiti, doğruluk, taktik tespitleri, Türkçe yorumlar, PGN ayrıştırma ve dışa aktarma, varyant modu, önbellek, alıştırma değerlendirmesi, istatistik toplama, Lichess/Chess.com yanıtlarının okunması ve oyun sonu veritabanı metinleri için birim testleri vardır.

## Lisanslar ve kaynaklar

- **Stockfish** ([stockfish.js](https://github.com/nmrugg/stockfish.js), lite tek iş parçacıklı sürüm) GPL-3.0 lisanslıdır. Uygulamayı dağıtırsan Stockfish’in kaynak koduna erişim sağlaman gerekir.
- **Oyun sonu veritabanı:** [lichess tablebase API](https://tablebase.lichess.ovh) (Syzygy).
- **Açılış veritabanı:** [lichess-org/chess-openings](https://github.com/lichess-org/chess-openings), CC0 (kamu malı).
- İkonlar, renkler ve yedek hamle sesleri bu proje için üretilmiştir. `public/sounds/` klasörü yalnızca yerelde kullanılır ve depoya/siteye konmaz.
