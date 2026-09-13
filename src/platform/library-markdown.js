// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import { createMarkdownCacheKey } from '../cache/markdown-cache.js';
import { sha256Hex } from '../core/sha256.js';
import { MINERU_PARSER_PROFILE_ID } from '../mineru/parser-profile.js';
import { MISTRAL_PARSER_PROFILE_ID } from '../mistral/parser-profile.js';
import { LOCAL_PARSER_PROFILE, readLocalMinerUResult } from '../mineru/local-result.js';
import { SharedConversions } from '../core/shared-conversions.js';

export function collectLibraryPDFs(zotero, items) {
    const found = new Map();
    for (const item of items || []) {
        const attachments = item?.isRegularItem?.()
            ? (item.getAttachments?.() || []).map(id => zotero.Items.get(id)) : [item];
        for (const pdf of attachments) {
            if (pdf?.isPDFAttachment?.() && !pdf.deleted) found.set(pdf.id, pdf);
        }
    }
    return [...found.values()];
}

export function resolveLibraryPDF(zotero, item) {
    if (item?.isPDFAttachment?.()) return item;
    if (!item?.isRegularItem?.()) return null;
    return (item.getAttachments?.() || []).map(id => zotero.Items.get(id))
        .find(attachment => attachment?.isPDFAttachment?.()) || null;
}

export class LibraryMarkdown {
    constructor({ zotero, io, path, cache, translate, createFilePicker, preparePDFIndex, comparePDFs = null, snapshotStore = null, createAbortController = () => new AbortController(), accountPool = null, getProvider = () => 'mineru' }) {
        Object.assign(this, { zotero, io, path, cache, translate, createFilePicker, preparePDFIndex });
        this.states = new Map();
        this.pending = new Map();
        this.signatures = new Map();
        this.queue = Promise.resolve();
        this.disposed = false;
        this.comparePDFs = comparePDFs;
        this.snapshotStore = snapshotStore;
        this.createAbortController = createAbortController;
        this.accountPool = accountPool;
        this.getProvider = getProvider;
        this.shared = new SharedConversions(createAbortController);
        this.saveTail = Promise.resolve();
    }

    async register(pluginID) {
        if (!this.zotero.ItemTreeManager?.registerColumn) return;
        this.column = await this.zotero.ItemTreeManager.registerColumn({
            dataKey: 'mkteroMarkdownStatus', label: 'Markdown', pluginID,
            dataProvider: item => this.label(item),
        });
        this.observer = this.zotero.Notifier.registerObserver({
            notify: (event, type, ids) => {
                if (type !== 'item') return;
                for (const id of ids || []) {
                    if (event === 'delete') {
                        this.states.delete(id);
                        this.pending.delete(id);
                        this.signatures.delete(id);
                    }
                    else if (event === 'modify') {
                        const item = this.zotero.Items.get(id);
                        if (item?.isPDFAttachment?.()) this.checkIdentity(item);
                    }
                }
            },
        }, ['item'], 'mktero-library-status');
    }

    label(item) {
        if (item?.isRegularItem?.()) {
            const pdfs = collectLibraryPDFs(this.zotero, [item]);
            if (!pdfs.length) return '';
            const labels = pdfs.map(pdf => this.label(pdf));
            const done = pdfs.filter(pdf => this.ready(pdf.id)).length;
            const active = pdfs.find(pdf => ['queued', 'running', 'uploading', 'cloudQueued', 'downloading', 'saving'].includes(this.states.get(pdf.id)?.state));
            return `${done}/${pdfs.length} ${active ? this.label(active) : labels.every(label => label === labels[0]) ? labels[0] : this.translate('library.summary')}`;
        }
        const pdf = resolveLibraryPDF(this.zotero, item);
        if (!pdf) return '';
        this.checkIdentity(pdf);
        const cached = this.states.get(pdf.id);
        if (!cached && !this.pending.has(pdf.id)) {
            const ticket = {};
            this.pending.set(pdf.id, ticket);
            this.queue = this.queue.then(async () => {
                if (this.disposed || this.pending.get(pdf.id) !== ticket) return;
                try {
                    const match = await this.find(pdf);
                    if (this.pending.get(pdf.id) === ticket) this.set(pdf.id, match?.saved ? 'saved' : match ? 'ready' : 'missing');
                }
                catch {
                    if (this.pending.get(pdf.id) === ticket) this.set(pdf.id, 'unavailable');
                }
            }).finally(() => {
                if (this.pending.get(pdf.id) === ticket) this.pending.delete(pdf.id);
            });
        }
        return this.translate(`library.${cached?.state || 'checking'}`);
    }

    ready(id) { return ['ready', 'saved', 'saveFailed'].includes(this.states.get(id)?.state); }

    checkIdentity(pdf) {
        const signature = JSON.stringify([pdf.attachmentPath, pdf.attachmentFilename, pdf.attachmentLinkMode]);
        const previous = this.signatures.get(pdf.id);
        this.signatures.set(pdf.id, signature);
        if (previous !== undefined && previous !== signature) this.invalidate(pdf.id);
    }

    redraw(ids) {
        if (this.disposed || !ids.length) return;
        const affected = new Set(ids);
        for (const id of ids) {
            const item = this.zotero.Items?.get?.(id);
            if (item?.parentID) affected.add(item.parentID);
        }
        const windows = this.zotero.getMainWindows?.() || [this.zotero.getMainWindow?.()];
        for (const window of windows) {
            const view = window?.ZoteroPane?.itemsView;
            if (!view) continue;
            view.invalidateRowCache?.([...affected]);
            for (const id of affected) {
                const row = view.getRowIndexByID?.(id);
                if (Number.isInteger(row) && row >= 0) view.tree?.invalidateRow?.(row);
            }
        }
    }

    set(id, state) {
        if (this.disposed) return;
        this.pending.delete(id);
        if (this.states.get(id)?.state === state) return;
        this.states.set(id, { state });
        this.redraw([id]);
    }

    invalidate(id) {
        const ids = id === undefined ? [...new Set([...this.states.keys(), ...this.pending.keys()])] : [id];
        for (const key of ids) {
            this.states.delete(key);
            this.pending.delete(key);
        }
        this.redraw(ids);
    }

    async find(pdf, localOnly = false) {
        const file = await pdf.getFilePathAsync();
        if (!file || !await this.io.exists(file)) throw new Error('The local PDF is unavailable.');
        const bytes = await this.io.read(file);
        const profiles = localOnly ? [LOCAL_PARSER_PROFILE]
            : [LOCAL_PARSER_PROFILE, MINERU_PARSER_PROFILE_ID, MISTRAL_PARSER_PROFILE_ID];
        for (const profile of profiles) {
            const key = await createMarkdownCacheKey(bytes, { parserProfile: profile });
            const result = await this.cache.get(key);
            if (result) return { result, key, profile, bytes };
        }
        if (this.snapshotStore && pdf.parentItem) {
            const note = await this.snapshotStore.findBySourcePDF(pdf.parentItem, pdf.key, String(pdf.libraryID));
            if (note) {
                const saved = await this.snapshotStore.read(note);
                const profile = saved.manifest.parserProfile;
                const key = await createMarkdownCacheKey(bytes, { parserProfile: profile });
                if (saved.sourceAvailable && saved.assetsComplete && key === saved.manifest.cacheKey) {
                    return { saved: true, key, profile, bytes, result: {
                        markdown: saved.markdown, assets: saved.assets,
                        assetBasePath: saved.manifest.assetBasePath || '', sourceMap: saved.sourceMap,
                    } };
                }
            }
        }
        return null;
    }

    async persist(pdf, result, key, profile) {
        const operation = this.saveTail.catch(() => {}).then(() => this.persistOne(pdf, result, key, profile));
        this.saveTail = operation;
        return operation;
    }

    async persistOne(pdf, result, key, profile) {
        if (!this.snapshotStore) return false;
        const written = await this.snapshotStore.saveSnapshot({
            pdfItem: pdf, parentItem: pdf.parentItem || null,
            markdown: result.markdown, assets: result.assets || [],
            assetBasePath: result.assetBasePath || '', sourceMap: result.sourceMap || [],
            cacheKey: key, parserProfile: profile,
        });
        const verified = await this.snapshotStore.read(written.noteID);
        if (!verified.sourceAvailable || !verified.assetsComplete || verified.markdown !== result.markdown
            || verified.assets.length !== (result.assets || []).length
            || JSON.stringify(verified.sourceMap || []) !== JSON.stringify(result.sourceMap || [])) {
            throw new Error(this.translate('library.snapshotIncomplete'));
        }
        for (let i = 0; i < verified.assets.length; i++) {
            const original = (result.assets || []).find(asset => asset.path === verified.assets[i].path);
            if (!original || await sha256Hex(original.data) !== await sha256Hex(verified.assets[i].data)) {
                throw new Error(this.translate('library.snapshotIncomplete'));
            }
        }
        if (key) await this.cache.removeEntry(key);
        this.set(pdf.id, 'saved');
        return true;
    }

    wrap(extractor) {
        const execute = async (id, options = {}) => {
            if (options.signal?.aborted) throw options.signal.reason || new Error('Cancelled');
            const pdf = await this.zotero.Items.getAsync(id);
            const match = options.forceRefresh ? null : await this.find(pdf);
            if (!match) {
                this.set(id, 'running');
                try {
                    const result = await extractor.extract(id, { ...options, onProgress: (progress, details) => {
                        const state = progress === 0 ? 'queued' : progress === 5 ? 'uploading' : progress === 12 ? 'cloudQueued'
                            : progress >= 95 ? 'downloading' : 'running';
                        this.set(id, state);
                        options.onProgress?.(progress, details);
                    } });
                    this.set(id, 'ready');
                    try {
                        this.set(id, 'saving');
                        if (!await this.persist(pdf, result, result.cacheKey, result.parserProfile || MINERU_PARSER_PROFILE_ID)) this.set(id, 'ready');
                    }
                    catch (error) {
                        if (result.cacheKey) await this.cache.put(result.cacheKey, result);
                        this.set(id, 'saveFailed');
                        if (!this.batch) this.zotero.getMainWindow?.()?.alert?.(this.translate('library.snapshotFailed'));
                    }
                    return result;
                }
                catch (error) {
                    this.set(id, options.signal?.aborted ? 'cancelled' : 'failed');
                    throw error;
                }
            }
            this.set(id, match.saved ? 'saved' : 'ready');
            if (options.signal?.aborted) throw options.signal.reason || new Error('Cancelled');
            this.preparePDFIndex?.(id, { fileData: match.bytes, signal: options.signal });
            options.onProgress?.(100);
            return { ...match.result, kind: 'markdown',
                provider: match.profile === MISTRAL_PARSER_PROFILE_ID ? 'mistral' : 'mineru',
                title: pdf.parentItem?.getDisplayTitle?.() || pdf.getDisplayTitle?.() || 'PDF',
                cacheKey: match.key, sourceHash: await sha256Hex(match.bytes),
                parserProfile: match.profile, cacheHit: true, warnings: [] };
        };
        const wrapped = { extract: (id, options = {}) => this.shared.run(id, options, async opts => {
            try { return await execute(id, opts); }
            catch (error) { this.set(id, opts.signal?.aborted ? 'cancelled' : 'failed'); throw error; }
        }) };
        this.extractor = wrapped;
        return wrapped;
    }

    async startBatch(ids) {
        if (this.batch) return;
        const controller = this.createAbortController();
        const batch = { controller, ids: [...new Set(ids)], next: 0, success: 0, skipped: 0, failed: 0, saveFailed: 0, errors: [], paused: false };
        this.batch = batch;
        try {
            const provider = this.getProvider();
            if (provider === 'mineru') await this.accountPool?.beginBatch();
            for (const id of batch.ids) if (!this.shared.runs.has(id)) this.set(id, 'queued');
            const worker = async () => {
                while (!controller.signal.aborted && !batch.paused && batch.next < batch.ids.length) {
                    const id = batch.ids[batch.next++];
                    try {
                        const result = await this.extractor.extract(id, { signal: controller.signal, provider });
                        if (result.cacheHit) batch.skipped++;
                        else if (this.states.get(id)?.state === 'saveFailed') batch.saveFailed++;
                        else batch.success++;
                    }
                    catch (error) {
                        if (controller.signal.aborted) break;
                        batch.failed++;
                        batch.errors.push(`${this.zotero.Items.get(id)?.getDisplayTitle?.() || id}: ${error.message}`);
                        if (['MINERU_ACCOUNTS_PAUSED', 'MINERU_API_KEY_REQUIRED'].includes(error.code)) batch.paused = true;
                    }
                }
            };
            await Promise.all(Array.from({ length: provider === 'mineru' ? 3 : 1 }, worker));
            for (const id of batch.ids) if (this.states.get(id)?.state === 'queued') this.set(id, batch.paused ? 'paused' : 'cancelled');
            if (!this.disposed) this.zotero.getMainWindow?.()?.alert?.(
                this.translate('batch.result', { success: batch.success, skipped: batch.skipped, failed: batch.failed, saveFailed: batch.saveFailed })
                + (batch.paused ? '\n' + this.translate('library.paused') : '')
                + (controller.signal.aborted ? '\n' + this.translate('library.cancelled') : '')
                + (batch.errors.length ? '\n' + batch.errors.slice(0, 10).join('\n') : '')
            );
        }
        finally { this.accountPool?.endBatch(); this.batch = null; }
    }

    stopBatch() { this.batch?.controller.abort(); }

    async import(id) {
        const picker = this.createFilePicker();
        const owner = this.zotero.getMainWindow();
        picker.init(owner, this.translate('library.import'), picker.modeGetFolder);
        if (await picker.show() === picker.returnCancel) return false;
        const directory = String(picker.file || '');
        if (!directory) return false;
        const pdf = await this.zotero.Items.getAsync(id);
        const bytes = await this.io.read(await pdf.getFilePathAsync());
        let sourceVerified = false;
        const origins = (await this.io.getChildren(directory)).filter(file => /_origin\.pdf$/i.test(file));
        if (origins.length > 1) throw new Error(this.translate('library.wrongPDF'));
        if (origins.length === 1) {
            const original = await this.io.read(origins[0]);
            sourceVerified = await sha256Hex(original) === await sha256Hex(bytes);
            if (!sourceVerified && this.comparePDFs) {
                sourceVerified = await this.comparePDFs(bytes, original).catch(() => false);
            }
            if (this.disposed) return false;
            if (!sourceVerified && !owner.confirm(this.translate('library.confirmDifferentPDF'))) return false;
        }
        else if (!owner.confirm(this.translate('library.confirmSource'))) return false;
        const imported = await readLocalMinerUResult(directory, { io: this.io, path: this.path });
        if (!sourceVerified) {
            imported.result.sourceMap = [];
            imported.hasSourceMap = false;
        }
        if (this.disposed) return false;
        const key = await createMarkdownCacheKey(bytes, { parserProfile: LOCAL_PARSER_PROFILE });
        if (await this.cache.get(key) && !owner.confirm(this.translate('library.replace'))) return false;
        await this.cache.put(key, imported.result);
        this.set(id, 'ready');
        if (await this.persist(pdf, imported.result, key, LOCAL_PARSER_PROFILE)) return true;
        owner.alert(this.translate(imported.hasSourceMap ? 'library.imported' : 'library.importedNoMap'));
        return true;
    }

    dispose() {
        this.disposed = true;
        this.stopBatch();
        this.shared.dispose();
        if (this.observer) this.zotero.Notifier.unregisterObserver(this.observer);
        if (this.column) void this.zotero.ItemTreeManager.unregisterColumn(this.column);
        this.states.clear();
        this.pending.clear();
        this.signatures.clear();
    }
}
