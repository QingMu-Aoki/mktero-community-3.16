// Copyright (c) 2026 青木 · Aoki
export function releaseRepository(environment = process.env) {
    const repository = String(environment.MKTERO_RELEASE_REPOSITORY || environment.GITHUB_REPOSITORY || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/.test(repository)
        || repository.toLowerCase() === 'tenglvjun/mktero') {
        throw new Error('Set MKTERO_RELEASE_REPOSITORY to your GitHub owner/repository before building. The upstream update channel is not allowed.');
    }
    if (environment.GITHUB_ACTIONS === 'true' && environment.GITHUB_REPOSITORY
        && repository !== environment.GITHUB_REPOSITORY) {
        throw new Error('The release repository must match the current GitHub Actions repository.');
    }
    return repository;
}

export function releaseManifest(source, repository) {
    const manifest = structuredClone(source);
    manifest.applications.zotero.update_url = `https://github.com/${repository}/releases/latest/download/updates.json`;
    return manifest;
}
