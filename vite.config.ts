import { existsSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// İsteğe bağlı ses dosyaları (public/sounds, depoya konmaz). Yalnızca var olanlar istenir;
// olmayanlar için tarayıcıda üretilen yedek ses çalar.
const soundFiles = existsSync('public/sounds')
  ? readdirSync('public/sounds').filter((f) => f.endsWith('.mp3')).map((f) => f.slice(0, -4))
  : [];

export default defineConfig({
  // Göreli yollar: uygulama alt klasörde (ör. kullanici.github.io/satranc-analiz/) de çalışır.
  base: './',
  plugins: [react(), tailwindcss()],
  define: { __SOUND_FILES__: JSON.stringify(soundFiles) },
});
