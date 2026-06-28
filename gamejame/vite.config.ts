import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PixiJS v8 ships top-level await, which Vite's prod build rejects under the default target.
export default defineConfig({
  plugins: [react()],
  // GitHub Pages project site serves at https://<user>.github.io/<repo>/ — the base
  // MUST match the repo name (leading + trailing slash). The engine resolves all asset
  // URLs against this via BASE_URL. Change it if you rename the repo.
  base: '/the-grandmas-shispering/',
  build: { target: 'esnext' },
})
