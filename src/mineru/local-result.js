// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import { zipSync } from 'fflate';
import { extractMinerUResultFromZip } from './zip-markdown.js';
import { prepareMinerUResult } from './mineru-result.js';

export const LOCAL_PARSER_PROFILE = 'mineru-local-import-v1';

// Reuse the cloud archive validator and source-map normalization.
export async function readLocalMinerUResult(directory, { io, path }) {
    const entries = await io.getChildren(directory);
    const markdownFiles = entries.filter(file => /\.md$/i.test(file));
    if (markdownFiles.length !== 1) throw new Error('Select a folder containing exactly one Markdown file.');
    const files = {};
    let total = 0;
    async function read(file, name, limit) {
        const stat = await io.stat(file);
        if (stat.type !== 'regular' || stat.size > limit) throw new Error('Unsupported or oversized result file.');
        total += stat.size;
        if (total > 220 * 1024 * 1024) throw new Error('Result exceeds the import size limit.');
        files[name] = await io.read(file, { maxBytes: limit + 1 });
        if (files[name].length > limit) throw new Error('Result file exceeds the size limit.');
    }
    await read(markdownFiles[0], 'full.md', 50 * 1024 * 1024);
    const lists = entries.filter(file => /(?:^|[\\/])(?:.*_)?content_list\.json$/i.test(file));
    if (lists.length > 1) throw new Error('Multiple content lists found.');
    if (lists.length) await read(lists[0], 'content_list.json', 20 * 1024 * 1024);
    for (const name of ['images', 'assets']) {
        const folder = path.join(directory, name);
        if (!await io.exists(folder)) continue;
        const stat = await io.stat(folder);
        if (stat.type !== 'directory') throw new Error('Invalid image directory.');
        const images = await io.getChildren(folder);
        if (images.length > 10000) throw new Error('Too many image files.');
        for (const image of images) {
            if (/\.(png|jpe?g|gif|webp)$/i.test(image)) {
                await read(image, `${name}/${path.filename(image)}`, 25 * 1024 * 1024);
            }
        }
    }
    const result = prepareMinerUResult(extractMinerUResultFromZip(zipSync(files, { level: 0 })));
    return { result, hasSourceMap: Boolean(result.sourceMap?.length) };
}
