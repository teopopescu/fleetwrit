import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dashboard dev server runs on 5174 so it never clashes with the site (4321).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174, strictPort: true },
  preview: { port: 5174, strictPort: true },
});
