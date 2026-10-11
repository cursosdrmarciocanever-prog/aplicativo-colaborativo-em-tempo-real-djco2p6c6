/* Vitest: regras puras (src/**) e permissões do PocketBase (tests/backend/**) */
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 20000,
    hookTimeout: 60000,
  },
})
