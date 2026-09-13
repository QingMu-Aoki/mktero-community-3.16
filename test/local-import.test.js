// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import test from 'node:test';
import assert from 'node:assert/strict';
import { readLocalMinerUResult } from '../src/mineru/local-result.js';
import { LibraryMarkdown, resolveLibraryPDF } from '../src/platform/library-markdown.js';
import { createMarkdownCacheKey } from '../src/cache/markdown-cache.js';
import { MINERU_PARSER_PROFILE_ID } from '../src/mineru/parser-profile.js';

function files(entries) {
    const encoded = Object.fromEntries(Object.entries(entries).map(([key, value]) => [key, new TextEncoder().encode(value)]));
    return {
        io: {
            getChildren: async dir => Object.keys(encoded).filter(key => key.startsWith(dir + '/') && !key.slice(dir.length + 1).includes('/')),
            exists: async dir => Object.keys(encoded).some(key => key.startsWith(dir + '/')),
            stat: async file => ({ type: encoded[file] ? 'regular' : 'directory', size: encoded[file]?.length || 0 }),
            read: async file => encoded[file],
        },
        path: { join: (...parts) => parts.join('/'), filename: file => file.split('/').at(-1) },
    };
}

test('imports local filenames, images and normalized source positions', async () => {
    const adapters = files({
        '/doc/paper.md': '# Title\n\nA paragraph.\n\n![](images/figure.png)',
        '/doc/paper_content_list.json': JSON.stringify([{ type: 'text', text: 'A paragraph.', page_idx: 0, bbox: [10, 10, 900, 100] }]),
        '/doc/images/figure.png': 'image',
        '/doc/paper_content_list_v2.json': '{}',
    });
    const { result, hasSourceMap } = await readLocalMinerUResult('/doc', adapters);
    assert.match(result.markdown, /Title/);
    assert.equal(result.assets[0].path, 'images/figure.png');
    assert.equal(hasSourceMap, true);
});

test('imports Markdown without pretending source mappings exist', async () => {
    const result = await readLocalMinerUResult('/doc', files({ '/doc/full.md': '# Hello' }));
    assert.equal(result.hasSourceMap, false);
});

test('rejects ambiguous Markdown and malformed content lists', async () => {
    await assert.rejects(readLocalMinerUResult('/doc', files({ '/doc/a.md': 'a', '/doc/b.md': 'b' })), /exactly one/);
    await assert.rejects(readLocalMinerUResult('/doc', files({ '/doc/a.md': 'a', '/doc/content_list.json': '{}' })), /array/);
});

test('rejects oversize files before reading their contents', async () => {
    const adapters = files({ '/doc/a.md': 'a' });
    adapters.io.stat = async () => ({ type: 'regular', size: 60 * 1024 * 1024 });
    adapters.io.read = () => { assert.fail('must not read oversized file'); };
    await assert.rejects(readLocalMinerUResult('/doc', adapters), /oversized/);
});

test('rejects symlink files', async () => {
    const adapters = files({ '/doc/a.md': 'a' });
    adapters.io.stat = async () => ({ type: 'symlink', size: 1 });
    await assert.rejects(readLocalMinerUResult('/doc', adapters), /Unsupported/);
});

test('opens existing cached cloud results without submitting to a provider', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const key = await createMarkdownCacheKey(bytes, { parserProfile: MINERU_PARSER_PROFILE_ID });
    const pdf = { id: 1, isPDFAttachment: () => true, getFilePathAsync: async () => '/paper.pdf' };
    const library = new LibraryMarkdown({
        zotero: { Items: { getAsync: async () => pdf } },
        io: { exists: async () => true, read: async () => bytes },
        cache: { get: async candidate => candidate === key ? { markdown: '# Cached' } : null },
    });
    const wrapped = library.wrap({ extract: () => assert.fail('must not upload cached PDF') });
    const result = await wrapped.extract(1);
    assert.equal(result.markdown, '# Cached');
    assert.equal(result.cacheHit, true);
    library.cache.get = async () => null;
    assert.equal(await library.find(pdf), null);
});

test('resolves parent and PDF rows to the same attachment', () => {
    const pdf = { id: 7, isPDFAttachment: () => true };
    const zotero = { Items: { get: () => pdf } };
    assert.equal(resolveLibraryPDF(zotero, pdf), pdf);
    assert.equal(resolveLibraryPDF(zotero, { isRegularItem: () => true, getAttachments: () => [7] }), pdf);
    assert.equal(resolveLibraryPDF(zotero, {}), null);
});

test('unregisters column and observer and stops queued scans at shutdown', async () => {
    const removed = [];
    const library = new LibraryMarkdown({
        zotero: {
            ItemTreeManager: { registerColumn: async () => 'column', unregisterColumn: key => removed.push(key) },
            Notifier: { registerObserver: () => 'observer', unregisterObserver: key => removed.push(key) },
        },
    });
    await library.register('plugin');
    library.dispose();
    library.set(1, 'ready');
    assert.deepEqual(removed, ['observer', 'column']);
    assert.equal(library.states.size, 0);
});

function statusHarness() {
    const pdf = { id: 7, parentID: 1, attachmentPath: 'storage:paper.pdf', isPDFAttachment: () => true };
    const other = { id: 8, isPDFAttachment: () => true };
    let observer;
    const rows = [];
    const library = new LibraryMarkdown({
        zotero: {
            Items: { get: id => id === 7 ? pdf : other },
            ItemTreeManager: { registerColumn: async () => 'status', refreshColumns: () => assert.fail('must not refresh all columns') },
            Notifier: { registerObserver: value => { observer = value; return 1; } },
            getMainWindows: () => [{ ZoteroPane: { itemsView: {
                invalidateRowCache: () => {}, getRowIndexByID: id => ({ 1: 0, 7: 1, 8: 2 })[id] ?? false,
                tree: { invalidateRow: row => rows.push(row) },
            } } }],
        },
        translate: key => key,
    });
    return { library, pdf, other, rows, notify: (...args) => observer.notify(...args) };
}

test('reading-related item notifications keep all known states and avoid PDF scans', async () => {
    const h = statusHarness();
    await h.library.register('plugin');
    h.library.label(h.pdf);
    h.library.set(7, 'ready');
    h.library.set(8, 'missing');
    h.rows.length = 0;
    h.library.find = () => assert.fail('no rescan on ordinary reading');
    h.notify('modify', 'item', [7]);
    h.notify('redraw', 'item', [7]);
    h.notify('add', 'item', [100]);
    assert.equal(h.library.label(h.pdf), 'library.ready');
    assert.equal(h.library.label(h.other), 'library.missing');
    await h.library.queue;
    assert.deepEqual(h.rows, []);
});

test('status changes redraw only the affected PDF and parent, unchanged status does nothing', async () => {
    const h = statusHarness();
    h.library.set(7, 'ready');
    assert.deepEqual(h.rows, [1, 0]);
    h.rows.length = 0;
    h.library.set(7, 'ready');
    assert.deepEqual(h.rows, []);
    h.library.set(8, 'missing');
    h.rows.length = 0;
    h.library.invalidate(7);
    assert.equal(h.library.states.get(8).state, 'missing');
    assert.deepEqual(h.rows, [1, 0]);
});

test('changing a PDF attachment path invalidates only that attachment', async () => {
    const h = statusHarness();
    await h.library.register('plugin');
    h.library.checkIdentity(h.pdf);
    h.library.set(7, 'ready');
    h.library.set(8, 'ready');
    h.pdf.attachmentPath = 'storage:replacement.pdf';
    h.notify('modify', 'item', [7]);
    assert.equal(h.library.states.has(7), false);
    assert.equal(h.library.ready(8), true);
});

test('an old background check cannot overwrite a newer conversion status', async () => {
    const h = statusHarness();
    let finish;
    h.library.find = () => new Promise(resolve => { finish = resolve; });
    h.library.label(h.pdf);
    await Promise.resolve();
    h.library.set(7, 'ready');
    finish(null);
    await h.library.queue;
    assert.equal(h.library.ready(7), true);
});

for (const [name, origin, accept, expected] of [
    ['matching PDF retains mappings', 'selected-pdf', true, 'mapped'],
    ['different PDF requires confirmation and removes mappings', 'different-pdf', true, 'unmapped'],
    ['declining different PDF does not write cache', 'different-pdf', false, 'cancelled'],
    ['missing original requires confirmation and removes mappings', null, true, 'unmapped'],
]) {
    test(name, async () => {
        const entries = {
            '/doc/paper.md': '# Title\n\nA paragraph.',
            '/doc/paper_content_list.json': JSON.stringify([{ type: 'text', text: 'A paragraph.', page_idx: 0, bbox: [10, 10, 900, 100] }]),
            '/selected.pdf': 'selected-pdf',
        };
        if (origin) entries['/doc/paper_origin.pdf'] = origin;
        const adapters = files(entries);
        const writes = [];
        const confirmations = [];
        const library = new LibraryMarkdown({
            zotero: {
                Items: { getAsync: async () => ({ getFilePathAsync: async () => '/selected.pdf' }) },
                getMainWindow: () => ({ confirm: text => { confirmations.push(text); return accept; }, alert: () => {} }),
            },
            io: adapters.io, path: adapters.path, translate: key => key,
            cache: { get: async () => null, put: async (_key, result) => writes.push(result) },
            createFilePicker: () => ({init: () => {}, show: async () => 0, returnCancel: 1, file: '/doc'}),
        });
        const imported = await library.import(1);
        assert.equal(imported, expected !== 'cancelled');
        assert.equal(writes.length, expected === 'cancelled' ? 0 : 1);
        if (expected === 'mapped') {
            assert.ok(writes[0].sourceMap.length);
            assert.equal(confirmations.length, 0);
        }
        else if (expected === 'unmapped') {
            assert.deepEqual(writes[0].sourceMap, []);
            assert.equal(confirmations.length, 1);
        }
    });
}

test('automatic snapshot removes only its cache after read-back verification', async () => {
    const calls=[];
    const result={markdown:'# Saved',assets:[],sourceMap:[]};
    const library=new LibraryMarkdown({zotero:{},translate:k=>k,
        snapshotStore:{saveSnapshot:async()=>{calls.push('save');return {noteID:4};},read:async()=>{calls.push('read');return {...result,sourceAvailable:true,assetsComplete:true};}},
        cache:{removeEntry:async key=>calls.push('remove:'+key)},
    });
    assert.equal(await library.persist({id:7},result,'key','profile'),true);
    assert.deepEqual(calls,['save','read','remove:key']);
    assert.equal(library.states.get(7).state,'saved');
});

test('incomplete snapshot or failed saving retains cache', async()=>{
    for(const fails of [true,false]){
        let deleted=false;
        const library=new LibraryMarkdown({zotero:{},translate:k=>k,
            snapshotStore:{saveSnapshot:async()=>{if(fails)throw new Error('disk full');return {noteID:4};},read:async()=>({sourceAvailable:true,assetsComplete:false})},
            cache:{removeEntry:async()=>{deleted=true;}},
        });
        await assert.rejects(library.persist({id:7},{markdown:'Text',assets:[]},'key','profile'));
        assert.equal(deleted,false);
    }
});

test('opens verified snapshot after cache deletion without reconversion',async()=>{
    const bytes=new Uint8Array([1,2,3]);
    const key=await createMarkdownCacheKey(bytes,{parserProfile:MINERU_PARSER_PROFILE_ID});
    const pdf={id:7,key:'PDFKEY',libraryID:1,parentItem:{id:1},getFilePathAsync:async()=>'/a.pdf'};
    const library=new LibraryMarkdown({zotero:{Items:{getAsync:async()=>pdf}},io:{exists:async()=>true,read:async()=>bytes},
        cache:{get:async()=>null},snapshotStore:{findBySourcePDF:async()=>4,read:async()=>({sourceAvailable:true,assetsComplete:true,markdown:'# Saved',assets:[],sourceMap:[],manifest:{parserProfile:MINERU_PARSER_PROFILE_ID,cacheKey:key}})},
    });
    const result=await library.wrap({extract:()=>assert.fail('must not reconvert')}).extract(7);
    assert.equal(result.markdown,'# Saved');assert.equal(library.states.get(7).state,'saved');
});
