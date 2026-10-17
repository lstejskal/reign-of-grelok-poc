import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

// The engine must stay portable: no Node APIs, no browser APIs, no Phaser, nothing from the Node-only folder.
it('packages/engine/src imports nothing environment-specific', () => {
    const srcDir = path.resolve(import.meta.dirname, '../src');
    const files = fs.readdirSync(srcDir, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(5);

    const forbidden = /from\s+['"](node:|phaser|fs|path|\.\.\/node)|\b(document|window|localStorage)\./;
    for (const file of files) {
        const code = fs.readFileSync(path.join(srcDir, file), 'utf8');
        expect(code, file).not.toMatch(forbidden);
    }
});
