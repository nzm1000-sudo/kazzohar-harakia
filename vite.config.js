import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'
import legacyCssFallbacks from './scripts/legacyCssFallbacks.mjs'

const native = process.env.VITE_NATIVE === 'true'
// The downloadable full-text packs (public/torah-packs) are hosted with the web app (GitHub Pages) and downloaded on
// request; they are never inside the native app bundle, so the app's size does not grow by them.
const hostedOnlyPacks = () => ({
  name: 'kz-hosted-only-packs',
  apply: 'build',
  writeBundle(options) {
    if (native) rmSync(resolve(options.dir || 'dist', 'torah-packs'), { recursive: true, force: true })
  },
})

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), hostedOnlyPacks()],
  // Fallback declarations for older Android WebViews (dvh, inset, logical shorthands) — see scripts/legacyCssFallbacks.mjs.
  css: { postcss: { plugins: [legacyCssFallbacks()] } },
  base: native ? './' : '/kazzohar-harakia/',
})
