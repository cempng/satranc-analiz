import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Göreli yollar: uygulama alt klasörde (ör. kullanici.github.io/satranc-analiz/) de çalışır.
  base: './',
  plugins: [react(), tailwindcss()],
});
