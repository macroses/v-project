import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Components from 'unplugin-vue-components/vite'
import postcssNesting from 'postcss-nesting'

export default defineConfig({
  plugins: [
    vue(),
    Components()
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  css: {
    postcss: {
      plugins: [
        postcssNesting
      ]
    }
  }
  // build: {
  //   chunkSizeWarningLimit: 300,
  //   rollupOptions: {
  //     output: {
  //       manualChunks: {
  //         home: ['./src/views/Home.vue'],
  //         chartjs: ['chart.js'],
  //         gsap: ['gsap']
  //       },
  //     },
  //   },
  // },
});
