import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['@testing-library/jest-dom/vitest'],
    include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
