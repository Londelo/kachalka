import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { resolveTestDatabasePath } from './tests/harness/test-database-path'
import { resolveServerFsAllow, resolveSetupFiles } from './tests/harness/vitest-resolve'

const checkoutRoot = __dirname

process.env.DATABASE_PATH = resolveTestDatabasePath({
  checkoutRoot,
  envDatabasePath: process.env.DATABASE_PATH,
})

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: resolveSetupFiles(checkoutRoot),
    include: ['tests/unit/**/*.spec.ts', 'tests/unit/**/*.test.ts'],
    exclude: ['tests/e2e/**'],
  },
  server: {
    fs: {
      allow: resolveServerFsAllow(checkoutRoot),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(checkoutRoot, './src'),
    },
  },
})
