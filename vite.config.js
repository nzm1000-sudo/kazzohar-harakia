import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

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
  base: native ? './' : '/kazzohar-harakia/',
})
