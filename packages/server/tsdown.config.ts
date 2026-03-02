import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    bin: 'src/bin.ts'
  },
  format: 'esm',
  dts: { entry: 'src/index.ts' },
  clean: true,
  shims: true
})
