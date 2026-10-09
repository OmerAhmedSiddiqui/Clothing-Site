import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  // GitHub Pages serves the repo under /Clothing-Site/; Netlify and local serve from /.
  base: process.env.GITHUB_ACTIONS ? '/Clothing-Site/' : '/',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        classic: resolve(import.meta.dirname, 'classic.html'),
      },
    },
  },
})
