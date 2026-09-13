// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import { sha256Hex } from '../core/sha256.js';
import { SharedConversions } from '../core/shared-conversions.js';

export const accountFingerprint = key => sha256Hex(new TextEncoder().encode(key));

// One pool is shared by reader conversions and all library windows.
export class MinerUAccountPool {
    constructor({ conversion, pendingTasks, getAccounts, now = Date.now, createAbortController = () => new AbortController() }) {
        Object.assign(this, { conversion, pendingTasks, getAccounts, now });
        this.accounts = [];
        this.waiters = [];
        this.active = 0;
        this.locked = false;
        this.initializing = null;
        this.shared = new SharedConversions(createAbortController);
    }

    async configure() {
        if (this.locked || this.active || this.preparing || this.waiters.length) return;
        if (!this.initializing) {
            this.initializing = Promise.all(this.getAccounts().map(async row => ({
                ...row, fingerprint: await accountFingerprint(row.apiKey), active: 0,
                until: 0, failures: 0, paused: !row.enabled,
            }))).then(rows => { this.accounts = rows; }).finally(() => { this.initializing = null; });
        }
        await this.initializing;
    }

    async beginBatch() { await this.configure(); this.locked = true; }
    endBatch() { this.locked = false; }

    rateLimited(token, delay) {
        const account = this.accounts.find(row => row.apiKey === token);
        if (!account) return;
        const backoff = delay ?? Math.min(60000, 2000 * (2 ** account.failures++));
        account.until = Math.max(account.until, this.now() + Math.max(1000, backoff));
        this.drain();
    }

    async waitForAccount(token, signal) {
        const account = this.accounts.find(row => row.apiKey === token);
        while (account && account.until > this.now()) {
            await new Promise((resolve, reject) => {
                const done = () => { signal?.removeEventListener('abort', abort); resolve(); };
                const timer = setTimeout(done, account.until - this.now());
                const abort = () => { clearTimeout(timer); signal?.removeEventListener('abort', abort); reject(signal.reason || new Error('Cancelled')); };
                if (signal?.aborted) abort();
                else signal?.addEventListener('abort', abort, { once: true });
            });
        }
    }

    convert(options) {
        return options.key ? this.shared.run(options.key, options, opts => this.convertOnce(opts)) : this.convertOnce(options);
    }

    async convertOnce(options) {
        await this.configure();
        if (!this.accounts.length) throw new Error('A MinerU API Token is required');
        this.preparing = (this.preparing || 0) + 1;
        options.onProgress?.(0);
        let account;
        try {
            const pending = options.key && !options.forceRefresh
                ? this.conversion.currentTasks?.get(options.key) || await this.pendingTasks.get(options.key) : null;
            // Legacy tasks were submitted by the original, first configured key.
            const owner = pending ? pending.accountID || this.accounts[0]?.fingerprint : null;
            account = await this.acquire(owner, options.signal);
        }
        finally { this.preparing--; }
        try {
            return await this.conversion.convert({ ...options, apiKey: account.apiKey, accountID: account.fingerprint });
        }
        catch (error) {
            if (error.code === 'MINERU_API_KEY_INVALID' || [401, 403].includes(error.status)
                || error.code === 'MINERU_QUOTA_EXCEEDED') account.paused = true;
            if (error.status === 429) this.rateLimited(account.apiKey, error.retryAfterMs);
            // Do not allow credentials echoed by remote services into the UI/logs.
            const clean = new Error(`MinerU (${account.name}): ${error.code || 'request failed'}${error.status ? ` HTTP ${error.status}` : ''}`);
            clean.code = error.code;
            clean.status = error.status;
            throw options.signal?.aborted ? options.signal.reason : clean;
        }
        finally { account.active--; this.active--; this.drain(); }
    }

    acquire(owner, signal) {
        return new Promise((resolve, reject) => {
            const waiter = { owner, signal, resolve, reject };
            waiter.abort = () => {
                this.waiters = this.waiters.filter(row => row !== waiter);
                reject(signal.reason || new Error('Cancelled'));
                this.drain();
            };
            if (signal?.aborted) return waiter.abort();
            signal?.addEventListener('abort', waiter.abort, { once: true });
            this.waiters.push(waiter);
            this.drain();
        });
    }

    drain() {
        clearTimeout(this.timer);
        for (const waiter of [...this.waiters]) {
            const available = this.accounts.filter(row => !row.paused && (!waiter.owner || row.fingerprint === waiter.owner));
            const account = available.find(row => row.active < row.concurrency && row.until <= this.now());
            if (!account && available.length) continue;
            this.waiters = this.waiters.filter(row => row !== waiter);
            waiter.signal?.removeEventListener('abort', waiter.abort);
            if (!account) {
                const error = new Error('MinerU account unavailable / 账号不可用，请检查设置后重试');
                error.code = 'MINERU_ACCOUNTS_PAUSED';
                waiter.reject(error);
            }
            else { account.active++; this.active++; waiter.resolve(account); }
        }
        const next = this.accounts.filter(row => !row.paused && row.until > this.now()).map(row => row.until);
        if (this.waiters.length && next.length) this.timer = setTimeout(() => this.drain(), Math.min(...next) - this.now());
    }

    dispose() {
        this.shared.dispose();
        clearTimeout(this.timer);
        for (const waiter of this.waiters.splice(0)) {
            waiter.signal?.removeEventListener('abort', waiter.abort);
            waiter.reject(new Error('Cancelled'));
        }
    }
}
