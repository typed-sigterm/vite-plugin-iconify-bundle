# vite-plugin-iconify-offline ![Latest version](https://img.shields.io/github/v/release/typed-sigterm/vite-plugin-iconify-offline) ![License](https://img.shields.io/github/license/typed-sigterm/vite-plugin-iconify-offline) ![OSS Lifecycle](https://img.shields.io/osslifecycle?file_url=https%3A%2F%2Fraw.githubusercontent.com%2Ftyped-sigterm%2Fvite-plugin-iconify-offline%2Fmain%2FOSSMETADATA) [![GitHub Stars](https://img.shields.io/github/stars/typed-sigterm/vite-plugin-iconify-offline)](https://github.com/typed-sigterm/vite-plugin-iconify-offline)

On-demand bundle Iconify icons to the client.

Originally developed to fix [nuxt/ui#5242](https://github.com/nuxt/ui/issues/5242), and the implementation is based on the idea from [@adamrybak](https://github.com/nuxt/ui/issues/5242#issuecomment-3713093172).

## Installation

```bash
npm install -D vite-plugin-iconify-offline
```

## Usage

1. Configure in `vite.config.ts`

    ```ts
    import { defineConfig } from 'vite';
    import iconifyOffline from 'vite-plugin-iconify-offline';

    export default defineConfig({
      plugins: [
        iconifyOffline({
          module: '@iconify/vue',
          files: ['./components/**/*.vue', './pages/**/*.vue'],
        }),
      ],
    });
    ```

2. Add types in `tsconfig.json`

    ```json
    {
      "compilerOptions": {
        "types": ["vite-plugin-iconify-offline/client"]
      }
    }
    ```

3. Install icon collections you want to use, e.g.,

    ```bash
    npm install -D @iconify-json/lucide @iconify-json/mdi
    ```

4. Initialize in `main.ts`

    ```ts
    import { loadIcons } from 'virtual:iconify-offline';
    
    loadIcons();
    ```

## Options

See `Options` interface in `src/index.ts`.
