# Görev
React + TypeScript + Vite ile tarayıcıda çalışan bir satranç oyun analiz uygulaması geliştir. Kullanıcı bir PGN yapıştırır veya yükler; uygulama oyunu Stockfish ile hamle hamle analiz eder, her hamleyi sınıflandırır (Brillant, Harika, En İyi, Mükemmel, İyi, Kitap, Belirsiz, Hata, Büyük Hata, Kaçırılan Fırsat), Türkçe yorum üretir ve oyun özeti gösterir. Sunucu gerekmesin, her şey istemci tarafında çalışsın. Arayüz dili Türkçe.

## Teknoloji
- React 18 + TypeScript + Vite + Tailwind CSS, durum yönetimi için Zustand
- chess.js: kurallar, PGN/FEN ayrıştırma, SAN/UCI dönüşümü
- react-chessboard: tahta (sürükle-bırak, ok çizimi, kare vurgulama)
- Stockfish WASM, tek iş parçacıklı "lite" sürüm (COOP/COEP başlığı gerektirmesin), Web Worker içinde, UCI protokolüyle. Dosyaları public/ klasöründen yükle.
- Recharts: değerlendirme grafiği
- Vitest: birim testleri
- Güncel ve birbiriyle uyumlu paket sürümleri seç.

## 1. Tahta ve arayüz
- Düzen: solda dikey değerlendirme çubuğu (eval bar), ortada tahta, sağda panel (hamle listesi, yorum kutusu, özet). Tahtanın altında gezinme düğmeleri ve değerlendirme grafiği.
- Tahtayı çevirme, koordinatlar, son hamlenin karelerini vurgulama.
- Oynanan hamlenin hedef karesinin köşesinde sınıflandırma rozeti (ikon).
- Motorun en iyi hamlesini yeşil okla göster (açılıp kapatılabilsin).
- Klavye: ← / → bir hamle, Home / End başa/sona, F tahtayı çevir.
- Hamle listesi iki sütunlu (Beyaz / Siyah), her hamlenin yanında sınıf ikonu; tıklayınca o pozisyona git.
- Varyant modu: kullanıcı tahtada farklı bir hamle oynayabilsin, motor yeni pozisyonu analiz etsin, "Ana hatta dön" düğmesi olsun.

## 2. PGN girişi
- Metin kutusuna yapıştırma, .pgn dosya yükleme ve sürükle-bırak.
- Dosyada birden çok oyun varsa listeden seçtir.
- Başlıkları göster: White, Black, WhiteElo, BlackElo, Result, Date, Event, ECO/Opening.
- [FEN] etiketi varsa o pozisyondan başla.
- Hatalı PGN'de hangi hamlede sorun olduğunu söyleyen Türkçe hata mesajı.
- Test için "Örnek oyun yükle" düğmesi (Morphy – Opera Oyunu, 1858).

## 3. Motor analizi
- Başlangıç pozisyonu dahil her pozisyonu analiz et: `position fen ...` + `go depth N`, `MultiPV 3`.
- Derinlik seçimi: Hızlı 12 / Normal 16 / Derin 20 (varsayılan 16).
- Her pozisyon için sakla: en iyi hamle, değerlendirme (cp veya mate), MultiPV satırları, PV devam çizgisi.
- UCI skoru sırası gelen tarafa göredir; hepsini beyaz perspektifine çevir.
- İlerleme çubuğu ("Hamle 23/64 analiz ediliyor") ve İptal düğmesi. Analiz sürerken de gezinme mümkün olsun.
- Sonuçları PGN + derinlik hash'iyle localStorage'da önbelleğe al (try/catch ile).

## 4. Kazanma olasılığı (Win%)
- WinPct(cp) = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1), cp değerini ±1000 ile sınırla.
- Mat skorlarında kazanan taraf için 100, kaybeden için 0.
- Her hamle için, hamleyi yapan tarafın perspektifinden:
  kayıp = max(0, WinPct(hamleden önceki pozisyon) - WinPct(hamleden sonraki pozisyon))

## 5. Hamle sınıflandırması (bu sırayla kontrol et)
1. Kitap: Pozisyon açılış veritabanında var (lichess-org/chess-openings TSV dosyaları, CC0 lisanslı; EPD/FEN ile eşle). Açılış adını da göster.
2. Brillant (!!): Kayıp ≤ 2 VE hamle bir taş fedası (piyon sayılmaz; hamleden sonra rakip taşı alarak net en az 2 puan materyal kazanabiliyor ama motor değerlendirmesi korunuyor) VE hamleden önce oyuncu zaten ezici üstün değil (WinPct < 90) VE hamleden sonra kaybetmiyor (WinPct ≥ 50).
3. Harika (!): En iyi hamle VE (tek iyi hamle: ikinci en iyi hamleyle arasında ≥ 10 Win% fark VEYA oyunun gidişatını değiştiriyor, örn. rakibin hatasını cezalandırarak eşit/kaybeden pozisyondan kazanana geçiş).
4. Kaçırılan Fırsat: Rakip önceki hamlede Hata/Büyük Hata yaptı, oyuncunun kazanan bir devamı vardı (en iyi hamleyle WinPct ≥ 70) ama oynanan hamlenin kaybı ≥ 10.
5. En İyi: Motorun 1 numaralı hamlesi.
6. Mükemmel: kayıp < 2
7. İyi: 2 ≤ kayıp < 5
8. Belirsiz (?!): 5 ≤ kayıp < 10
9. Hata (?): 10 ≤ kayıp < 20
10. Büyük Hata (??): kayıp ≥ 20

Ek kurallar:
- Tek yasal hamle varsa "Zorunlu" olarak işaretle, doğruluğa katma.
- Hamleden önce ve sonra pozisyon tamamen kazanılmış/kaybedilmişse (WinPct > 97 veya < 3), hata sınıfını bir kademe yumuşat.
- Tüm eşikleri tek bir config dosyasında topla.

## 6. Doğruluk (Accuracy)
- Hamle doğruluğu = 103.1668 * exp(-0.04354 * kayıp) - 3.1669, 0–100 arasına kırp.
- Oyuncu doğruluğu = aritmetik ortalama ile harmonik ortalamanın ortalaması.
- Açılış / oyun ortası / oyun sonu için ayrı doğruluk.

## 7. Türkçe yorumlar
Her hamle için kural tabanlı açıklama üret:
- Sınıf ve nedeni: "Bu bir Büyük Hata. Daha iyisi Fxf7+ idi. Şimdi rakip Vxd8 ile veziri kazanıyor."
- Taktik tespitleri: korumasız (asılı) taş, taş kaybı, çatal, açmaz, mat tehdidi, kaçırılan mat ("Mat 3'ü kaçırdın"), rok hakkının kaybı, değişim.
- En iyi hamle ve motorun 3–5 hamlelik devam çizgisi (SAN).
- Değerlendirme değişimi: "+1.2 → -2.5".
- İsteğe bağlı: Ayarlar'da bir LLM API anahtarı alanı (yalnızca tarayıcıda saklanır). Girilirse FEN + hamle + sınıf + motor çizgisini gönderip daha doğal bir "koç yorumu" al; anahtar yoksa kural tabanlı yorum kullanılsın.

## 8. Oyun özeti
- İki oyuncu için doğruluk yüzdesi ve her sınıftan kaç hamle (ikon + sayı tablosu).
- Değerlendirme grafiği (x: hamle, y: Win% veya ±10 ile sınırlı eval); tıklanınca o hamleye gitsin; hata noktaları renkli.
- "Kritik anlar": en büyük 3 hata ve brillant/harika hamleler, tıklanabilir.

## 9. Tasarım
- Koyu, modern tema. Özgün renk ve ikonlar kullan, başka sitelerin logo ve ikonlarını kopyalama.
- Sınıf renkleri: Brillant camgöbeği, Harika mavi, En İyi/Mükemmel yeşil, İyi açık yeşil, Kitap kahverengi, Belirsiz sarı, Hata turuncu, Büyük Hata kırmızı, Kaçırılan Fırsat pembe.
- Mobil uyumlu: dar ekranda tahta üstte, panel altta.

## 10. Kod yapısı
- src/engine (worker, UCI sarmalayıcı), src/analysis (winPct, classify, accuracy, comments), src/components, src/store.
- Sınıflandırma, Win% ve doğruluk saf fonksiyon olsun; Vitest ile testlerini yaz (eşikler, mat skorları, perspektif dönüşümü).
- README: kurulum, çalıştırma, mimari.

## Çalışma şekli
Aşama aşama ilerle, her aşamanın sonunda çalışan bir uygulama bırak:
1. Proje iskeleti + tahta + PGN yükleme + hamle gezinme
2. Stockfish worker + eval bar + en iyi hamle oku
3. Tüm oyunun analizi + sınıflandırma + ikonlar
4. Yorumlar + özet ekranı + grafik
5. Varyant modu, önbellek, cilalama, testler
Her aşamadan sonra dur, ne yaptığını özetle ve nasıl test edeceğimi anlat. Ben "devam" demeden sonraki aşamaya geçme.
