import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    'src/index.ts',
  ],
  dts: true,
  clean: true,
  deps: {
    onlyBundle: false,
  },
});

// Didn't add `rolldown` to `peerDependencies` because Vite 7 is still widely used
// Will add after Nuxt upgrades to Vite 8
