import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const profile = process.env['ALPHA_HARNESS_PROFILE']
const profileMatch = profile?.match(/^acc([1-9][0-9]*)$/)
if (profile && !profileMatch) {
  throw new Error('ALPHA_HARNESS_PROFILE must have the form acc1, acc2, etc.')
}
const profileNumber = profileMatch ? Number(profileMatch[1]) : 0
if (!Number.isSafeInteger(profileNumber) || profileNumber > 57535) {
  throw new Error('ALPHA_HARNESS_PROFILE must be between acc1 and acc57535')
}

// The backend runs as a separate process. Proxying /api and /ws in dev means the
// frontend never needs CORS or credentials of its own.
const backendPort = Number(process.env['ALPHA_HARNESS_PORT'] ?? 8000 + profileNumber)
if (!Number.isInteger(backendPort) || backendPort < 1 || backendPort > 65535) {
  throw new Error('ALPHA_HARNESS_PORT must be an integer from 1 to 65535')
}
const frontendPort = Number(process.env['ALPHA_HARNESS_FRONTEND_PORT'] ?? 5173 + profileNumber)
if (!Number.isInteger(frontendPort) || frontendPort < 1 || frontendPort > 65535) {
  throw new Error('ALPHA_HARNESS_FRONTEND_PORT must be an integer from 1 to 65535')
}
const BACKEND = `http://127.0.0.1:${backendPort}`

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  // Built into the backend package, which serves it: `uvx alpha-harness` needs no Node.
  build: {
    outDir: path.resolve(import.meta.dirname, '../backend/src/alpha_harness/web'),
    emptyOutDir: true,
    // Screens are already lazy. Splitting the framework out of the entry as well cost 24 kB
    // gzipped more on first load for chunks that cache across wheel upgrades — worth it
    // over a network, worth nothing from 127.0.0.1. The warning is written for a CDN.
    chunkSizeWarningLimit: 700,
  },
  server: {
    port: frontendPort,
    strictPort: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: true },
      '/ws': { target: BACKEND, ws: true, changeOrigin: true },
    },
  },
})
