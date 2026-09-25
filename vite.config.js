import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const isNative = process.env.VITE_NATIVE === 'true'
const base = isNative ? './' : '/kazzohar-harakia/'

// Regression Protection: Warn if native build uses wrong base
if (isNative && base.includes('/kazzohar-harakia/')) {
  console.error(
    '\n❌ REGRESSION DETECTED: Native build is using GitHub-Pages base path!\n' +
    'This will cause BLACK SCREEN on iOS.\n' +
    'Use: npm run build:native (not npm run build)\n'
  )
  process.exit(1)
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Post-build verification plugin
    {
      name: 'verify-native-paths',
      apply: 'build',
      async closeBundle() {
        if (isNative) {
          const distDir = path.resolve(process.cwd(), 'dist')
          const indexPath = path.join(distDir, 'index.html')
          
          if (!fs.existsSync(indexPath)) {
            console.warn('⚠️  Could not verify native paths (index.html not found)')
            return
          }
          
          const html = fs.readFileSync(indexPath, 'utf-8')
          
          // Check for BROKEN absolute paths
          if (html.includes('/kazzohar-harakia/assets') || html.includes('/kazzohar-harakia/branding')) {
            console.error(
              '\n❌ CRITICAL REGRESSION: Native build contains absolute paths!\n' +
              'Found: /kazzohar-harakia/assets/... in dist/index.html\n' +
              'This WILL cause BLACK SCREEN on iOS.\n' +
              'Root cause: VITE_NATIVE not set or vite.config.js not working correctly.\n'
            )
            process.exit(1)
          }
          
          // Verify CORRECT relative paths exist
          if (!html.includes('./assets') && !html.includes('./branding')) {
            console.warn('⚠️  Warning: Native build may not have relative paths')
          } else {
            console.log('✅ Native build verified: Using relative paths (./assets/...)')
          }
          
          // Verify no service worker in native mode
          if (html.includes('registerServiceWorker') || html.includes('new WorkBox')) {
            console.warn('⚠️  Warning: Service worker found in native build (should be disabled)')
          } else {
            console.log('✅ Native build verified: Service worker disabled')
          }
        }
      }
    }
  ],
  base,
})

