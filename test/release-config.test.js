// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseRepository, releaseManifest } from '../scripts/release-config.mjs';

test('release requires a real configured fork repository and rejects upstream', () => {
    for (const value of ['', 'tenglvjun/mktero', 'https://github.com/user/repo', '../repo', 'user/repo/other']) {
        assert.throws(() => releaseRepository({ MKTERO_RELEASE_REPOSITORY: value }));
    }
    assert.equal(releaseRepository({ GITHUB_REPOSITORY: 'owner/community' }), 'owner/community');
    assert.throws(() => releaseRepository({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'a/b', MKTERO_RELEASE_REPOSITORY: 'c/d' }));
});

test('packaged update channel follows release repository without modifying source', () => {
    const source = { applications: { zotero: { id: '{test}', strict_min_version: '7.0' } } };
    const result = releaseManifest(source, 'owner/community');
    assert.equal(result.applications.zotero.update_url, 'https://github.com/owner/community/releases/latest/download/updates.json');
    assert.equal(source.applications.zotero.update_url, undefined);
    assert.equal(result.applications.zotero.id, source.applications.zotero.id);
});
