import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
export default defineConfig({
  base: process.env.CAIRN_ASSET_BASE || '/',
  plugins: [react(), tailwindcss()],
  optimizeDeps: { include: ['media-chrome/react', 'media-chrome/react/menu', 'media-chrome/dist/lang/zh-CN.js'] },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    host: '127.0.0.1',
    proxy: process.env.CAIRN_DEV_BACKEND
      ? { '/api': { target: process.env.CAIRN_DEV_BACKEND, changeOrigin: true } }
      : undefined,
  },
  build: {
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        codeSplitting: { groups: [{ name: 'react-vendor', test: /\/node_modules\/(?:react|react-dom|scheduler)\// }] },
      },
    },
  },
})
