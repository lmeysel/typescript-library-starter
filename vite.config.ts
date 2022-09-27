import { defineConfig } from 'vite';
import Dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/--libraryname--.ts'),
      name: '--libraryname--',
    },
    rollupOptions: {
      // see: https://vitejs.dev/guide/build.html#library-mode
      // define external dependencies here
      external: [],
    },
  },
  plugins: [Dts({ outputDir: 'dist/types' })],
});
