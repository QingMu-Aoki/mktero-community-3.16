// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const manifest = JSON.parse(await readFile(
    new URL('../manifest.json', import.meta.url),
    'utf8'
));
const packageMetadata = JSON.parse(await readFile(
    new URL('../package.json', import.meta.url),
    'utf8'
));
const packageLock = JSON.parse(await readFile(
    new URL('../package-lock.json', import.meta.url),
    'utf8'
));

test('allows installation on the tested Zotero 10 minor version', () => {
    assert.equal(manifest.applications.zotero.strict_max_version, '10.0.*');
});

test('source manifest uses independent identity and no upstream update channel', () => {
    assert.equal(manifest.name, 'Mktero Community');
    assert.match(manifest.applications.zotero.id, /^\{[0-9a-f-]{36}\}$/);
    assert.equal(manifest.applications.zotero.update_url, undefined);
});

test('declares the scalable Mktero logo for extension surfaces', () => {
    assert.deepEqual(manifest.icons, {
        48: 'ui/icons/mktero.svg',
        96: 'ui/icons/mktero.svg',
    });
});

test('keeps the installable package version metadata valid and consistent', () => {
    assert.match(
        manifest.version,
        /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/
    );
    assert.equal(packageMetadata.version, manifest.version);
    assert.equal(packageLock.version, manifest.version);
    assert.equal(packageLock.packages[''].version, manifest.version);
});
