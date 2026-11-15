/** Analizdeki tüm sabitler ve eşikler burada toplanır. */

/** Win% formülü: 50 + 50 * (2 / (1 + exp(-K * cp)) - 1). */
export const WIN_PCT_K = 0.00368208;
/** cp değeri Win% hesaplanmadan önce ±bu değerle sınırlanır. */
export const WIN_PCT_CP_CLAMP = 1000;

/** Motor derinlik seçenekleri. */
export const DEPTH_OPTIONS = [
  { label: 'Hızlı', depth: 12 },
  { label: 'Normal', depth: 16 },
  { label: 'Derin', depth: 20 },
] as const;
export const DEFAULT_DEPTH = 16;

/** Taş değerleri (fedâ tespiti için). */
export const PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Hamle sınıflandırma eşikleri (Win% puanı cinsinden). */
export const CLASSIFY = {
  /** kayıp < 2 → Mükemmel */
  excellentMaxLoss: 2,
  /** kayıp < 5 → İyi */
  goodMaxLoss: 5,
  /** kayıp < 10 → Belirsiz */
  inaccuracyMaxLoss: 10,
  /** kayıp < 20 → Hata, aksi halde Büyük Hata */
  mistakeMaxLoss: 20,
  brilliant: {
    maxLoss: 2,
    /** Oyuncu hamleden önce bundan fazla kazanıyorsa brillant sayılmaz. */
    maxWinBefore: 90,
    minWinAfter: 50,
    /** Rakibin hemen kazanabileceği net materyal (piyon hariç taş). */
    minSacrifice: 2,
  },
  great: {
    /** En iyi ile ikinci en iyi hamle arasındaki fark. */
    minGapToSecond: 10,
    /** Gidişatı değiştiren hamle: rakibin hatasından önce oyuncu en fazla bu kadar iyiydi… */
    turningMaxWinBefore: 55,
    /** …ve hamleden sonra en az bu kadar iyi. */
    turningMinWinAfter: 70,
  },
  missed: {
    /** En iyi hamleyle ulaşılabilecek en düşük Win%. */
    minBestWin: 70,
    minLoss: 10,
  },
  /** Bu sınırların dışında pozisyon zaten belli kabul edilir; hata sınıfı bir kademe yumuşatılır. */
  decided: { high: 97, low: 3 },
} as const;

/** Hamle doğruluğu: a * exp(-k * kayıp) + b, 0–100 arası. */
export const ACCURACY = {
  a: 103.1668,
  k: 0.04354,
  b: -3.1669,
  /** Harmonik ortalamada kullanılan en düşük değer (sıfıra bölmeyi önler). */
  harmonicFloor: 1,
} as const;

/** Oyun evreleri. */
export const PHASES = {
  /** İlk bu kadar yarım hamle (veya kitap devam ettikçe) açılış sayılır. */
  openingPlies: 20,
  /** Şah ve piyonlar hariç toplam taş değeri bu değere inince oyun sonu başlar (ör. her tarafta kale + fil + at = 11, toplam 22). */
  endgameMaxMaterial: 26,
} as const;
