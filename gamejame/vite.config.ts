import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// PixiJS v8 ships top-level await, which Vite's prod build rejects under the default target.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // GitHub Pages project site serves at https://<user>.github.io/<repo>/ — the prod base
  // MUST match the repo name. `build` AND `preview` run mode='production' (so preview mirrors
  // Pages); `dev` runs mode='development' and stays at '/' so the in-editor asset previews
  // resolve at localhost root.
  base: mode === 'production' ? '/the-grandmas-shispering/' : '/',
  build: { target: 'esnext' },
}))
