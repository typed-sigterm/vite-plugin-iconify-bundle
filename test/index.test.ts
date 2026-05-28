import { unlinkSync, writeFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import iconifyOffline from '../src/index';

describe('vite-plugin-iconify-offline', () => {
  it('should find icons in transform hook', async () => {
    const plugin = iconifyOffline({ module: '@iconify/vue' }) as any;
    const code = `const icon = "lucide-activity";`;
    plugin.transform(code, 'test.ts');

    const result = await plugin.load.handler('\0virtual:iconify-offline');
    expect(result).toContain('activity');
    expect(result).toContain('addIcon');
    expect(result).toContain('lucide:activity');
  });

  it('should find icons in files globs', async () => {
    const tempFile = 'temp-test-file.txt';
    writeFileSync(tempFile, 'lucide-air-vent');

    const plugin = iconifyOffline({ module: '@iconify/vue', files: [tempFile] }) as any;
    await plugin.buildStart.apply({ addWatchFile: () => {} }, [{}]);

    const result = await plugin.load.handler('\0virtual:iconify-offline');
    expect(result).toContain('air-vent');

    unlinkSync(tempFile);
  });

  it('should handle additional icons', async () => {
    const plugin = iconifyOffline({ module: '@iconify/vue', additional: ['lucide:check-square'] }) as any;

    const result = await plugin.load.handler('\0virtual:iconify-offline');
    expect(result).toContain('check-square');
  });
});
