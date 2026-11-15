/** Hamle sesleri: dosya kullanmadan Web Audio ile üretilen kısa, özgün sesler. */

export type MoveSound = 'move' | 'capture' | 'check' | 'castle' | 'mate';

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Ahşap "tık" sesi: kısa gürültü patlaması + düşük frekanslı ton. */
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

/** Kısa uyarı tonu (şah için). */
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

export function playMoveSound(kind: MoveSound) {
  const ac = audio();
  if (!ac) return;
  const t = ac.currentTime + 0.005;
  switch (kind) {
    case 'move':
      knock(ac, t, 220, 0.5);
      break;
    case 'capture':
      knock(ac, t, 160, 0.7, 0.12);
      knock(ac, t + 0.045, 120, 0.45, 0.1);
      break;
    case 'castle':
      knock(ac, t, 220, 0.45);
      knock(ac, t + 0.09, 240, 0.45);
      break;
    case 'check':
      knock(ac, t, 200, 0.5);
      chime(ac, t + 0.02, 880, 0.12);
      break;
    case 'mate':
      knock(ac, t, 180, 0.6);
      chime(ac, t + 0.02, 660, 0.12);
      chime(ac, t + 0.16, 494, 0.12);
      break;
  }
}

/** SAN'dan ses türü: "Rd8#" → mate, "Bxb5+" → check, "O-O" → castle, "Nxe5" → capture. */
export function soundForSan(san: string): MoveSound {
  if (san.includes('#')) return 'mate';
  if (san.includes('+')) return 'check';
  if (san.startsWith('O-O')) return 'castle';
  if (san.includes('x')) return 'capture';
  return 'move';
}
