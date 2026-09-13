// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAccounts, getMinerUAccounts, saveMinerUAccounts } from '../src/config/mineru-accounts.js';
import { MinerUAccountPool, accountFingerprint } from '../src/mineru/account-pool.js';
import { LibraryMarkdown, collectLibraryPDFs } from '../src/platform/library-markdown.js';
import { SharedConversions } from '../src/core/shared-conversions.js';
import { translateEnglish } from '../src/i18n/localization.js';
import { mountMinerUAccounts } from '../src/ui/mineru-account-settings.js';
import { JSDOM } from 'jsdom';

const tick = () => new Promise(resolve => setTimeout(resolve, 5));
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const accounts = [1, 2, 3].map(n => ({ name: `Account ${n}`, apiKey: `test-${n}`, enabled: true, concurrency: 3 }));
function preferences() {
    const map = new Map([['extensions.mktero.mineruApiKey', 'legacy']]);
    return { Prefs: { get: key => map.get(key), set: (key, value) => map.set(key, value) } };
}

test('configuration accepts one token and ignores blank rows', () => {
    assert.equal(normalizeAccounts([accounts[0], { apiKey: ' ' }]).length, 1);
    assert.throws(() => normalizeAccounts(accounts), /one API Token/);
    assert.throws(() => normalizeAccounts([{ apiKey: 'a', concurrency: 4 }]), /1–3/);
    const zotero = preferences();
    assert.equal(getMinerUAccounts(zotero)[0].apiKey, 'legacy');
    zotero.Prefs.set('extensions.mktero.mineruAccounts', JSON.stringify(accounts));
    assert.deepEqual(getMinerUAccounts(zotero), [accounts[0]]);
    assert.throws(() => saveMinerUAccounts(zotero, accounts));
    saveMinerUAccounts(zotero, getMinerUAccounts(zotero));
    assert.equal(JSON.parse(zotero.Prefs.get('extensions.mktero.mineruAccounts')).length, 1);
    saveMinerUAccounts(zotero, []);
    assert.deepEqual(getMinerUAccounts(zotero), []);
});

test('settings display at most one masked token through add, delete and save', () => {
    const dom = new JSDOM('<div id="root"></div>');
    const { document } = dom.window;
    const zotero = preferences();
    const root = mountMinerUAccounts({ document, zotero, container: document.getElementById('root'), translate: translateEnglish });
    const button = label => [...root.querySelectorAll('button')].find(node => node.textContent === label);
    assert.equal(button('Add account').disabled, true);
    assert.equal(root.querySelectorAll('input[type=password]').length, 1);
    root.querySelector('input[type=password]').value = 'replacement';
    button('Save accounts').click();
    assert.equal(getMinerUAccounts(zotero)[0].apiKey, 'replacement');
    button('Remove').click(); button('Save accounts').click();
    assert.equal(getMinerUAccounts(zotero).length, 0);
    button('Add account').click(); button('Add account').click();
    assert.equal(root.querySelectorAll('input[type=password]').length, 1);
    dom.window.close();
});

test('three accounts run nine tasks, refill slots, and freeze settings during batch', async () => {
    const gate = deferred();
    const count = new Map(); const max = new Map(); let started = 0;
    let configured = accounts;
    const pool = new MinerUAccountPool({ getAccounts: () => configured, pendingTasks: { get: async () => null }, conversion: {
        convert: async ({ apiKey }) => {
            started++; count.set(apiKey, (count.get(apiKey) || 0) + 1);
            max.set(apiKey, Math.max(max.get(apiKey) || 0, count.get(apiKey)));
            await gate.promise; count.set(apiKey, count.get(apiKey) - 1); return apiKey;
        },
    } });
    await pool.beginBatch();
    configured = [];
    const jobs = Array.from({ length: 12 }, () => pool.convert({}));
    await tick(); assert.equal(started, 9);
    gate.resolve(); await Promise.all(jobs);
    assert.deepEqual([...max.values()], [3, 3, 3]);
    pool.endBatch(); pool.dispose();
});

test('pending tasks use the original account; missing owner never resubmits', async () => {
    const owner = await accountFingerprint(accounts[1].apiKey);
    const calls = [];
    const pool = new MinerUAccountPool({ getAccounts: () => accounts, pendingTasks: { get: async () => ({ accountID: owner }) }, conversion: {
        convert: async opts => { calls.push(opts); },
    } });
    await pool.beginBatch(); await pool.convert({ key: 'saved' });
    assert.equal(calls[0].apiKey, accounts[1].apiKey);
    assert.equal(calls[0].accountID, owner);
    pool.accounts[1].paused = true;
    await assert.rejects(pool.convert({ key: 'saved' }), { code: 'MINERU_ACCOUNTS_PAUSED' });
    assert.equal(calls.length, 1); pool.dispose();
});

test('identical PDF content shares one account operation across attachment IDs', async () => {
    const gate = deferred(); let calls = 0;
    const pool = new MinerUAccountPool({ getAccounts: () => accounts, pendingTasks: { get: async () => null }, conversion: {
        convert: async () => { calls++; await gate.promise; return 'result'; },
    } });
    await pool.beginBatch();
    const one = pool.convert({ key: 'same-content' }); const two = pool.convert({ key: 'same-content' });
    await tick(); assert.equal(calls, 1); gate.resolve();
    assert.deepEqual(await Promise.all([one, two]), ['result', 'result']); pool.dispose();
});

test('rate limiting isolates an account; authentication failure pauses its future work', async () => {
    const calls = [];
    const pool = new MinerUAccountPool({ getAccounts: () => accounts, pendingTasks: { get: async () => null }, conversion: {
        convert: async ({ apiKey }) => { calls.push(apiKey); const e = new Error(apiKey); e.code = 'MINERU_API_KEY_INVALID'; throw e; },
    } });
    await pool.beginBatch(); pool.rateLimited(accounts[0].apiKey, 60000);
    await assert.rejects(pool.convert({}), error => !error.message.includes('test-') && error.code === 'MINERU_API_KEY_INVALID');
    assert.equal(calls[0], accounts[1].apiKey);
    await assert.rejects(pool.convert({}));
    assert.equal(calls[1], accounts[2].apiKey);
    const controller = new AbortController(); const waiting = pool.convert({ signal: controller.signal });
    await tick(); controller.abort(); await assert.rejects(waiting);
    pool.dispose();
});

test('selection expands all child PDFs and deduplicates parent plus children', () => {
    const pdf = id => ({ id, isPDFAttachment: () => true });
    const a = pdf(1), b = pdf(2);
    const zotero = { Items: { get: id => ({ 1: a, 2: b, 3: {} })[id] } };
    const parent = { isRegularItem: () => true, getAttachments: () => [1, 2, 3] };
    assert.deepEqual(collectLibraryPDFs(zotero, [parent, a]).map(row => row.id), [1, 2]);
    assert.deepEqual(collectLibraryPDFs(zotero, [b]).map(row => row.id), [2]);
});

test('shared reader and batch conversion survives one subscriber closing', async () => {
    const shared = new SharedConversions(() => new AbortController());
    const gate = deferred(); let calls = 0; let signal;
    const execute = async options => { calls++; signal = options.signal; await gate.promise; return 'done'; };
    const reader = new AbortController();
    const one = shared.run(1, { signal: reader.signal }, execute);
    const two = shared.run(1, {}, execute);
    await tick(); reader.abort(); await assert.rejects(one);
    assert.equal(signal.aborted, false); gate.resolve(); assert.equal(await two, 'done');
    assert.equal(calls, 1); shared.dispose();
});

function library() {
    const alerts = [];
    const lib = new LibraryMarkdown({
        zotero: { Items: { get: id => ({ id, getDisplayTitle: () => `PDF ${id}` }), getAsync: async id => ({ id }) }, getMainWindow: () => ({ alert: text => alerts.push(text) }) },
        translate: translateEnglish, cache: { put: async () => {} }, getProvider: () => 'mistral',
    });
    return { lib, alerts };
}

test('batch skips existing results, continues after failure, and reports save failure once', async () => {
    const { lib, alerts } = library(); let converted = [];
    lib.find = async pdf => pdf.id === 1 ? { saved: true, profile: 'local', bytes: new Uint8Array([1]), result: { markdown: 'cached' } } : null;
    lib.persist = async pdf => { if (pdf.id === 4) throw new Error('disk full'); lib.set(pdf.id, 'saved'); return true; };
    lib.wrap({ extract: async id => { converted.push(id); if (id === 2) throw new Error('failed'); return { markdown: 'new', cacheKey: 'key' }; } });
    await lib.startBatch([1, 2, 3, 4]);
    assert.deepEqual(converted, [2, 3, 4]);
    assert.equal(lib.states.get(1).state, 'saved');
    assert.equal(lib.states.get(2).state, 'failed');
    assert.equal(lib.states.get(3).state, 'saved');
    assert.equal(lib.states.get(4).state, 'saveFailed');
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /converted 1, skipped 1, failed 1, snapshot save failed 1/);
});

test('stop cancels current work and leaves remaining files unsubmitted', async () => {
    const { lib } = library(); const started = deferred(); const calls = [];
    lib.find = async () => null;
    lib.wrap({ extract: (id, { signal }) => new Promise((resolve, reject) => {
        calls.push(id); started.resolve(); signal.addEventListener('abort', () => reject(signal.reason));
    }) });
    const batch = lib.startBatch([1, 2, 3]); await started.promise; lib.stopBatch(); await batch;
    assert.deepEqual(calls, [1]); assert.equal(lib.states.get(2).state, 'cancelled'); lib.dispose();
});

test('snapshot saves are serialized even when conversions finish together', async () => {
    const { lib } = library(); const gate = deferred(); const calls = [];
    lib.persistOne = async pdf => { calls.push(pdf.id); if (pdf.id === 1) await gate.promise; };
    const one = lib.persist({ id: 1 }); const two = lib.persist({ id: 2 });
    await tick(); assert.deepEqual(calls, [1]); gate.resolve(); await Promise.all([one, two]); assert.deepEqual(calls, [1, 2]);
});

test('parent status aggregates all PDFs and redraw only invalidates affected rows', () => {
    const rows = []; const invalidated = [];
    const a = { id: 1, parentID: 10, isPDFAttachment: () => true };
    const b = { id: 2, parentID: 10, isPDFAttachment: () => true };
    const parent = { id: 10, isRegularItem: () => true, getAttachments: () => [1, 2] };
    const { lib } = library();
    lib.zotero.Items.get = id => ({ 1: a, 2: b, 10: parent })[id];
    lib.zotero.getMainWindows = () => [{ ZoteroPane: { itemsView: {
        invalidateRowCache: ids => invalidated.push(ids), getRowIndexByID: id => id, tree: { invalidateRow: row => rows.push(row) },
    } } }];
    lib.set(1, 'saved'); lib.set(2, 'queued');
    assert.match(lib.label(parent), /^1\/2 Queued/);
    assert.deepEqual(invalidated, [[1, 10], [2, 10]]);
    assert.deepEqual(rows, [1, 10, 2, 10]);
});
