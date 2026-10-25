import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// GitHub Pages project sites are served from /<repo>/, so the built asset URLs must
// carry that prefix. Derive it from the repository name instead of hard-coding it,
// and keep the domain root for user sites (<user>.github.io), local development and
// hosts such as Render. Set VITE_BASE to override (for example a custom domain).
const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? ''
const isUserSite = repository.toLowerCase().endsWith('.github.io')
const pagesBase =
  process.env.GITHUB_ACTIONS === 'true' && repository && !isUserSite ? `/${repository}/` : '/'

export default defineConfig({
  base: process.env.VITE_BASE || pagesBase,
  plugins: [react(), tailwindcss()],
})
