import type { IconifyJSONIconsData } from '@iconify/types';
import type { Plugin } from 'vite';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { exactRegex } from 'rolldown/filter';
import { glob } from 'tinyglobby';

export interface Options {
  /**
   * Module to import addIcon from. Candidate values:
   *
   * - Web Component for React: `@iconify-icon/react`
   * - Web Component for Solid: `@iconify-icon/solid`
   * - Vue: `@iconify/vue`
   * - React: `@iconify/react`
   * - Svelte: `@iconify/svelte`
   */
  module: string
  /**
   * Globs to scan for icons.
   */
  files: string[]
  /**
   * Additional icons to include in the bundle.
   *
   * @example 'collection:name'
   */
  additional?: string[]
}

const VIRTUAL_MODULE_ID = 'virtual:iconify-offline';
const PACKAGE_NAME_REGEX = /^(?:@(?:[a-z0-9-*~][a-z0-9-*._~]*)?\/[a-z0-9-._~]|[a-z0-9-~])[a-z0-9-._~]*$/;

export default function iconifyOffline(options: Options) {
  const { files, additional = [], module } = options;
  const resolvedVirtualModuleId = `\0${VIRTUAL_MODULE_ID}`;

  if (!PACKAGE_NAME_REGEX.test(module))
    throw new Error(`Invalid module name: ${module}`);

  const collections = new Map<string, IconifyJSONIconsData>();
  const usedIcons = new Map<string, Set<string>>();
  let iconRegex: RegExp | null = null;
  let initPromise: Promise<void> | null = null;
  let isBuild = true;

  function addIcon(collectionName: string, iconName: string): boolean {
    const data = collections.get(collectionName);
    if (!data)
      return false;

    if (data.icons[iconName] || data.aliases?.[iconName]) {
      let set = usedIcons.get(collectionName);
      if (!set) {
        set = new Set();
        usedIcons.set(collectionName, set);
      }
      if (!set.has(iconName)) {
        set.add(iconName);
        return true;
      }
    }
    return false;
  }

  // Find all installed @iconify-json packages
  async function findCollections(): Promise<void> {
    const root = join(process.cwd(), 'node_modules');
    const scopePath = join(root, '@iconify-json');
    const dirStat = await stat(scopePath);
    if (dirStat.isDirectory()) {
      const dirs = await readdir(scopePath);
      await Promise.all(
        dirs.map(async (dir) => {
          const pkgPath = join(scopePath, dir, 'icons.json');
          const fileStat = await stat(pkgPath);
          if (fileStat.isFile()) {
            const content = await readFile(pkgPath, 'utf-8');
            const data = JSON.parse(content) as IconifyJSONIconsData;
            collections.set(dir, data);
          }
        }),
      );
    }

    const collectionPrefixes = Array.from(collections.keys());

    // Regex pattern: {collection}-{name}
    iconRegex = collectionPrefixes.length > 0
      ? new RegExp(`\\b(${collectionPrefixes.join('|')})[:-]([\\w-]+)`, 'g')
      : null;

    // Add additional icons
    for (const item of additional) {
      const parts = item.split(':');
      if (parts.length !== 2)
        throw new Error(`Invalid additional icon ${item}`);
      addIcon(parts[0]!, parts[1]!);
    }
  }

  function scanCode(code: string): void {
    if (!iconRegex)
      return;
    const matches = code.matchAll(iconRegex);
    for (const match of matches) {
      const [, collectionName, iconName] = match;
      if (collectionName && iconName)
        addIcon(collectionName, iconName);
    }
  }

  return {
    name: 'vite-plugin-iconify-bundle',
    enforce: 'post',

    configResolved(config) {
      isBuild = config.command === 'build';
      if (isBuild)
        initPromise = findCollections();
    },

    async buildStart() {
      if (!isBuild)
        return;
      await initPromise;

      const matchedFiles = await glob(files, { absolute: true });

      await Promise.all(
        matchedFiles.map(async (file) => {
          try {
            const content = await readFile(file, 'utf-8');
            scanCode(content);
          } catch (cause) {
            throw new Error(`Failed to read file ${file}`, { cause });
          }
        }),
      );
    },

    resolveId: {
      filter: {
        id: exactRegex(VIRTUAL_MODULE_ID),
      },
      handler: () => resolvedVirtualModuleId,
    },

    load: {
      filter: {
        id: exactRegex(resolvedVirtualModuleId),
      },
      async handler() {
        if (!isBuild)
          return `export function loadIcons() {}\n`;

        await initPromise;
        let code = `import { addIcon } from "${module}";\n\n`;

        for (const [collectionName] of usedIcons.entries()) {
          const varName = `_${collectionName.replace(/-/g, '_')}`;
          code += `import ${varName} from "@iconify-json/${collectionName}/icons.json";\n`;
        }

        code += `\nexport function loadIcons() {\n`;

        for (const [collectionName, icons] of usedIcons.entries()) {
          const varName = `_${collectionName.replace(/-/g, '_')}`;
          const full = collections.get(collectionName)!;
          code += `  const ref_${varName} = {\n`;
          if (full.width)
            code += `    width: ${full.width},\n`;
          if (full.height)
            code += `    height: ${full.height},\n`;
          code += `  };\n`;

          const queue = Array.from(icons);
          const added = new Set<string>();

          while (queue.length > 0) {
            const name = queue.shift()!;
            if (added.has(name))
              continue;
            added.add(name);

            let current = name;
            const pieces: string[] = [];
            let isValid = false;

            while (current) {
              if (full.icons && full.icons[current]) {
                pieces.push(`...${varName}.icons["${current}"]`);
                isValid = true;
                break;
              } else if (full.aliases && full.aliases[current]) {
                pieces.push(`...${varName}.aliases["${current}"]`);
                const parent = full.aliases![current]!.parent;
                current = parent;
              } else {
                break;
              }
            }

            if (isValid) {
              pieces.reverse();
              const safeName = name.replace(/[^a-z0-9]/gi, '_');
              code += `  const data_${varName}_${safeName} = { ...ref_${varName}, ${pieces.join(', ')} };\n`;
              code += `  addIcon("${collectionName}:${name}", data_${varName}_${safeName});\n`;
            }
          }
        }

        code += `}\n`;
        return code;
      },
    },
  } satisfies Plugin;
}
