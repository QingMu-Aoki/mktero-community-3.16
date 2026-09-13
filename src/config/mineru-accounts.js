// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import { MINERU_API_KEY_PREF } from './conversion-preferences.js';

export const MINERU_ACCOUNTS_PREF = 'extensions.mktero.mineruAccounts';

export function normalizeAccounts(value) {
    if (!Array.isArray(value)) throw new Error('Invalid MinerU accounts');
    const accounts = value.filter(row => String(row.apiKey || '').trim()).map((row, index) => ({
        name: String(row.name || `MinerU ${index + 1}`).trim().slice(0, 80),
        apiKey: String(row.apiKey).trim(),
        enabled: row.enabled !== false,
        concurrency: Number(row.concurrency ?? 3),
    }));
    if (accounts.length > 1) throw new Error('Only one API Token can be saved / 只能保存一个 API Token');
    if (new Set(accounts.map(row => row.apiKey)).size !== accounts.length) {
        throw new Error('Duplicate API Key / API Key 重复');
    }
    if (accounts.some(row => ![1, 2, 3].includes(row.concurrency))) {
        throw new Error('Concurrency must be 1–3 / 并发数必须为 1–3');
    }
    return accounts;
}

export function getMinerUAccounts(zotero) {
    const stored = zotero.Prefs.get(MINERU_ACCOUNTS_PREF, true);
    if (stored) {
        const rows = JSON.parse(stored);
        if (!Array.isArray(rows)) throw new Error('Invalid MinerU accounts');
        // Keep the original first account identity; never silently switch keys
        // for pending tasks. Other legacy records are removed only on save.
        return normalizeAccounts(rows.filter(row => String(row.apiKey || '').trim()).slice(0, 1));
    }
    const apiKey = String(zotero.Prefs.get(MINERU_API_KEY_PREF, true) || '').trim();
    return normalizeAccounts(apiKey ? [{ name: 'MinerU 1', apiKey }] : []);
}

export function saveMinerUAccounts(zotero, rows) {
    const accounts = normalizeAccounts(rows);
    zotero.Prefs.set(MINERU_ACCOUNTS_PREF, JSON.stringify(accounts), true);
    // Keep older single-key builds compatible; never resurrect a deleted key.
    zotero.Prefs.set(MINERU_API_KEY_PREF, accounts[0]?.apiKey || '', true);
    return accounts;
}
