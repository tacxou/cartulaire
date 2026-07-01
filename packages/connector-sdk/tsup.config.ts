import { defineConfig } from 'tsup'

const isProduction = process.env.NODE_ENV === 'production'
const isWatch = process.argv.includes('--watch')

export default defineConfig({
  clean: !isWatch,
  dts: true,
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  minify: isProduction,
  sourcemap: true,
})
