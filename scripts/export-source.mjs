// Copyright (c) 2026 青木 · Aoki
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = ['.gitattributes', '.gitignore', '.node-version', 'AGENTS.md', 'LICENSE', 'NOTICE.md', 'README.md', 'README.zh-CN.md', 'CHANGELOG.md', 'RELEASING.md', 'manifest.json', 'package.json', 'package-lock.json', 'prefs.js', 'docs/index.html', 'docs/404.html'];
const allowed = new Set(['.js', '.mjs', '.json', '.css', '.xhtml', '.html', '.svg', '.md', '.yml', '.yaml', '.txt']);
async function scan(directory) {
    for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
        const relative = `${directory}/${entry.name}`;
        if (entry.isSymbolicLink()) throw new Error(`Refusing symlink: ${relative}`);
        if (entry.isDirectory()) await scan(relative);
        // Reviewed 634-byte synthetic PDF used by offline annotation tests.
        else if (relative === 'test/fixtures/offline-annotation.pdf'
            || (allowed.has(path.extname(entry.name)) && !entry.name.startsWith('.env'))) files.push(relative);
        else throw new Error(`Review unexpected source file before export: ${relative}`);
    }
}
for (const directory of ['src', 'ui', 'test', 'scripts', '.github']) await scan(directory);
const entries = {};
for (const file of files.sort()) {
    const bytes = await readFile(path.join(root, file));
    if (/[A-Z]:\\{1,2}Users\\{1,2}|[A-Z]:\\{1,2}Selected papers\\|Zotero[\\/]storage[\\/][A-Z0-9]{8}/i.test(bytes.toString('utf8'))) {
        throw new Error(`Review personal data before export: ${file}`);
    }
    entries[`mktero-community/${file}`] = bytes;
}
const output = path.join(root, 'release-staging');
await mkdir(output, { recursive: true });
const archive = zipSync(entries, { level: 9, mtime: new Date(1980, 0, 1) });
const name = 'mktero-community-source.zip';
await writeFile(path.join(output, name), archive);
await writeFile(path.join(output, `${name}.sha256`), `${createHash('sha256').update(archive).digest('hex')}  ${name}\n`);
console.log(`Exported ${files.length} source files; no build outputs, dependencies, profiles, logs or Git history.`);
