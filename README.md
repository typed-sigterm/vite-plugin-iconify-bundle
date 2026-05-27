# vite-plugin-iconify-offline

A Vite plugin to bundle Iconify icons for offline use.

Originally developed to fix [nuxt/ui#5242](https://github.com/nuxt/ui/issues/5242), and the implementation is based on the idea from [@adamrybak](https://github.com/nuxt/ui/issues/5242#issuecomment-3713093172).

## Features

- Scans your source code for Iconify icons (format: `prefix:name` or `prefix-name`).
- Automatically collects icons from `@iconify-json/*` packages installed in your `node_modules`.
- Generates a virtual module `virtual:iconify-offline` that provides a `loadIcons()` function.
- Bundles only the used icons into your application, reducing the bundle size.

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
          files: ['./components/**/*.vue', './pages/**/*.vue'],
          additional: ['lucide:check-circle']
        })
      ]
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
