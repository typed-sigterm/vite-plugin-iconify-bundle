import type { Plugin, ViteDevServer } from 'vite';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { exactRegex } from 'rolldown/filter';
import { glob } from 'tinyglobby';

/**
 * Iconify collection data structure.
 */
export interface IconifyCollection {
  prefix: string
  icons: Record<string, { body: string }>
  aliases?: Record<string, { parent: string }>
  width?: number
  height?: number
}

export interface Options {
  /**
   * Globs to scan for icons. These files will be scanned in addition to those processed by Vite.
   */
  files?: string[]
  /**
   * Additional icons to include in the bundle.
   *
   * @example 'collection:name'
   */
  additional?: string[]
}

export default function iconifyOffline(options: Options = {}) {
  const { files = [], additional = [] } = options;
  const virtualModuleId = 'virtual:iconify-offline';
  const resolvedVirtualModuleId = `\0${virtualModuleId}`;

  const collections = new Map<string, IconifyCollection>();
  const usedIcons = new Map<string, Set<string>>(); // collection -> set of names
  let server: ViteDevServer | null = null;
  let preloadTask: Promise<void> | null = null;

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
  function findCollections(): void {
    const root = join(process.cwd(), 'node_modules');
    const scopePath = join(root, '@iconify-json');
    if (existsSync(scopePath)) {
      const dirs = readdirSync(scopePath);
      for (const dir of dirs) {
        const pkgPath = join(scopePath, dir, 'icons.json');
        if (existsSync(pkgPath)) {
          try {
            const data = JSON.parse(readFileSync(pkgPath, 'utf-8')) as IconifyCollection;
            collections.set(dir, data);
          } catch (cause) {
            throw new Error(`Failed to load collection ${dir}`, { cause });
          }
        }
      }
    }
  }

  findCollections();

  const collectionPrefixes = Array.from(collections.keys());

  // Regex pattern: {collection}-{name}
  const iconRegex = collectionPrefixes.length > 0
    ? new RegExp(`\\b(${collectionPrefixes.join('|')})[:-]([\\w-]+)`, 'g')
    : null;

  function scanCode(code: string): void {
    if (!iconRegex)
      return;
    const matches = code.matchAll(iconRegex);
    let changed = false;
    for (const match of matches) {
      const [, collectionName, iconName] = match;
      if (collectionName && iconName && addIcon(collectionName, iconName)) {
        changed = true;
      }
    }

    if (changed && server) {
      const mod = server.moduleGraph.getModuleById(resolvedVirtualModuleId);
      if (mod) {
        server.reloadModule(mod).catch(() => {});
      }
    }
  }

  // Add additional icons
  for (const item of additional) {
    const parts = item.split(':');
    if (parts.length !== 2)
      throw new Error(`Invalid additional icon ${item}`);
    addIcon(parts[0]!, parts[1]!);
  }

  return {
    name: 'vite-plugin-iconify-offline',
    enforce: 'post',

    configureServer(s) {
      server = s;
    },

    async buildStart(options) {
      const preload = async (): Promise<void> => {
        // Scan files
        if (files.length > 0) {
          const matchedFiles = await glob(files, { absolute: true });
          for (const file of matchedFiles) {
            try {
              const content = readFileSync(file, 'utf-8');
              scanCode(content);
              if (server)
                this.addWatchFile(file);
            } catch (cause) {
              throw new Error(`Failed to read file ${file}`, { cause });
            }
          }
        }

        // Preload module graph to ensure all icons are collected
        const input = options?.input;
        const loadIds = input
          ? (Array.isArray(input) ? [...input] : Object.values(input))
          : [];

        const loadedIds = new Set<string>();
        while (loadIds.length) {
          const loadId = loadIds.shift();
          if (!loadId || loadId === resolvedVirtualModuleId || loadId === virtualModuleId || loadedIds.has(loadId))
            continue;
          loadedIds.add(loadId);

          const info = await this.load({ id: loadId, resolveDependencies: true });
          if (info) {
            loadIds.push(...info.importedIds);
            loadIds.push(...info.dynamicallyImportedIds);
          }
        }
      };
      preloadTask = preload();
    },

    resolveId: {
      filter: {
        id: exactRegex(virtualModuleId),
      },
      handler: () => resolvedVirtualModuleId,
    },

    load: {
      filter: {
        id: exactRegex(resolvedVirtualModuleId),
      },
      async handler() {
        if (preloadTask)
          await preloadTask;
        let code = `import { addCollection } from "@iconify/vue";\n\n`;

        for (const [collectionName] of usedIcons.entries()) {
          const varName = `_${collectionName.replace(/-/g, '_')}`;
          code += `import ${varName} from "@iconify-json/${collectionName}/icons.json";\n`;
        }

        code += `\nexport function loadIcons() {\n`;

        for (const [collectionName, icons] of usedIcons.entries()) {
          const varName = `_${collectionName.replace(/-/g, '_')}`;
          const full = collections.get(collectionName)!;
          code += `  let subset_${varName} = {\n`;
          code += `    prefix: "${full.prefix}",\n`;
          if (full.width)
            code += `    width: ${full.width},\n`;
          if (full.height)
            code += `    height: ${full.height},\n`;
          code += `    icons: {},\n`;
          code += `    aliases: {}\n`;
          code += `  };\n`;

          const queue = Array.from(icons);
          const added = new Set<string>();
          const addedAliases = new Set<string>();

          while (queue.length > 0) {
            const name = queue.shift()!;
            if (added.has(name))
              continue;
            added.add(name);

            if (full.icons && full.icons[name]) {
              code += `  subset_${varName}.icons["${name}"] = ${varName}.icons["${name}"];\n`;
            } else if (full.aliases && full.aliases[name]) {
              addedAliases.add(name);
              code += `  subset_${varName}.aliases["${name}"] = ${varName}.aliases["${name}"];\n`;
              const alias = full.aliases[name];
              if (alias.parent) {
                queue.push(alias.parent);
              }
            }
          }
          code += `  addCollection(subset_${varName});\n`;
        }

        code += `}\n`;
        return code;
      },
    },

    transform(code, id) {
      if (id.includes('node_modules') || id === resolvedVirtualModuleId || id === virtualModuleId) {
        return;
      }
      scanCode(code);
    },
  } satisfies Plugin<any>;
}
