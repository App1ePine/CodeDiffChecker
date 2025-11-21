import { defineConfig } from '@rsbuild/core'
import { pluginVue } from '@rsbuild/plugin-vue'

export default defineConfig({
  plugins: [pluginVue()],
  resolve: {
    alias: {
      '@': './src',
    },
  },
  output: {
    distPath: {
      root: 'dist',
      html: './',
    },
    assetPrefix: '/',
    cleanDistPath: true,
    // inlineScripts: true,
    // inlineStyles: true,
  },
  html: {
    title: 'Code Diff Checker',
    meta: {
      charset: {
        charset: 'UTF-8',
      },
      description: 'A Code Diff Checker Based On git-diff-view',
    },
    // inject: 'body',
  },
  server: {
    base: '/',
    host: 'localhost',
    open: true,
    port: 3001,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
  performance: {
    removeConsole: true,
    chunkSplit: {
      strategy: 'split-by-experience',
    },
    // preload: undefined,
    // prefetch: undefined,
  },
})
