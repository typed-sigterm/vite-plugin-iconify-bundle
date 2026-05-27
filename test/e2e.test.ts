import type { OutputChunk, RolldownOutput } from 'rolldown';
import { join } from 'node:path';
import { build } from 'vite';
import { describe, expect, it } from 'vitest';
import pluginIconifyOffline from '../src/index';

describe('e2e', () => {
  const root = join(process.cwd(), 'test/fixtures/e2e');

  it('should bundle icons correctly', async () => {
    const [{ output }] = await build({
      root,
      logLevel: 'silent',
      plugins: [
        pluginIconifyOffline({
          files: [join(root, 'index.html')],
          additional: ['lucide:check', 'simple-icons:figma'],
        }),
      ],
      build: {
        write: false,
        lib: {
          entry: join(root, 'index.ts'),
          formats: ['es'],
          fileName: 'main',
        },
      },
    }) as [RolldownOutput];

    const chunks = output.filter(chunk => chunk.type === 'chunk');
    if (chunks.length === 0) {
      console.log('No chunks found in output:', JSON.stringify(output.map(f => ({ name: f.name, fileName: f.fileName, type: f.type })), null, 2));
    }
    const mainChunk = chunks[0] as OutputChunk;
    const code = mainChunk.code;

    expect(code).toContain('award'); // From index.ts
    expect(code).toContain('anchor'); // From index.html via files
    expect(code).toContain('arrow-right'); // From other.js (imported by index.ts)
    expect(code).toContain('check'); // From additional
    expect(code).toContain('github'); // From index.ts (simple-icons)
    expect(code).toContain('figma'); // From additional (simple-icons)

    expect(code).toMatch(/addCollection|addIcon|Br\(|Iconify/);
  });
});
