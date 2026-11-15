/**
 * Hamle sesleri: public/sounds/*.mp3 dosyaları Web Audio ile çalınır.
 * Dosya yüklenemezse (ör. silinmişse) tarayıcıda üretilen kısa yedek ses kullanılır.
 */

export type MoveSound =
  | 'move-self'
  | 'move-opponent'
  | 'capture'
  | 'castle'
  | 'move-check'
  | 'promote'
  | 'game-start'
  | 'game-end'
  | 'illegal';

let ctx: AudioContext | null = null;
const buffers = new Map<MoveSound, Promise<AudioBuffer | null>>();

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Derleme sırasında public/sounds içinde bulunan sesler (yoksa istek atılmaz, yedek ses çalar). */
const AVAILABLE = new Set<string>(typeof __SOUND_FILES__ === 'undefined' ? [] : __SOUND_FILES__);

function load(ac: AudioContext, kind: MoveSound): Promise<AudioBuffer | null> {
  if (!AVAILABLE.has(kind)) return Promise.resolve(null);
  let p = buffers.get(kind);
  if (!p) {
    p = fetch(`${import.meta.env.BASE_URL}sounds/${kind}.mp3`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data) => ac.decodeAudioData(data))
      .catch(() => null);
    buffers.set(kind, p);
  }
  return p;
}

/** Ahşap "tık" sesi (yedek): kısa gürültü patlaması + düşük frekanslı ton. */
function knock(ac: AudioContext, at: number, freq: number, volume: number, length = 0.09) {
  const noise = ac.createBuffer(1, Math.floor(ac.sampleRate * length), ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 6);
  const src = ac.createBufferSource();
  src.buffer = noise;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq * 4;
  filter.Q.value = 1.2;

  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(freq, at);
  osc.frequency.exponentialRampToValueAtTime(freq * 0.6, at + length);

  const gain = ac.createGain();
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);

  src.connect(filter).connect(gain);
  osc.connect(gain);
  gain.connect(ac.destination);
  src.start(at);
  osc.start(at);
  osc.stop(at + length);
}

/** Kısa ton (yedek). */
function chime(ac: AudioContext, at: number, freq: number, volume: number) {
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(volume, at + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.18);
  osc.connect(gain).connect(ac.destination);
  osc.start(at);
  osc.stop(at + 0.2);
}

function fallback(ac: AudioContext, kind: MoveSound, t: number) {
  switch (kind) {
    case 'capture':
      knock(ac, t, 160, 0.7, 0.12);
      knock(ac, t + 0.045, 120, 0.45, 0.1);
      break;
    case 'castle':
      knock(ac, t, 220, 0.45);
      knock(ac, t + 0.09, 240, 0.45);
      break;
    case 'move-check':
      knock(ac, t, 200, 0.5);
      chime(ac, t + 0.02, 880, 0.12);
      break;
    case 'game-start':
    case 'game-end':
      chime(ac, t, 660, 0.12);
      chime(ac, t + 0.14, kind === 'game-end' ? 494 : 880, 0.12);
      break;
    case 'illegal':
      chime(ac, t, 180, 0.15);
      break;
    default:
      knock(ac, t, kind === 'move-opponent' ? 190 : 220, 0.5);
  }
}

/** Ses dosyalarını önceden indirir (ilk hamlede gecikme olmasın). */
export function preloadSounds(kinds: MoveSound[]) {
  const ac = audio();
  if (ac) kinds.forEach((k) => void load(ac, k));
}

/** Sesi çalar; `delay` saniye sonra başlatılabilir. */
export function playSound(kind: MoveSound, delay = 0) {
  const ac = audio();
  if (!ac) return;
  void load(ac, kind).then((buffer) => {
    const at = ac.currentTime + 0.005 + delay;
    if (!buffer) {
      fallback(ac, kind, at);
      return;
    }
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(ac.destination);
    src.start(at);
  });
}

/**
 * SAN'a göre ses: "Rd8#"/"Bxb5+" → şah, "e8=Q" → terfi, "O-O" → rok, "Nxe5" → taş alma;
 * aksi halde tahtanın alt tarafındaki oyuncunun hamlesi "move-self", rakibinki "move-opponent".
 */
export function soundForSan(san: string, self: boolean): MoveSound {
  if (san.includes('+') || san.includes('#')) return 'move-check';
  if (san.includes('=')) return 'promote';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('x')) return 'capture';
  return self ? 'move-self' : 'move-opponent';
}
