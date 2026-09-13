// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import { getMinerUAccounts, saveMinerUAccounts } from '../config/mineru-accounts.js';

export function mountMinerUAccounts({ document, zotero, container, translate }) {
    const root = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
    root.id = 'mktero-accounts';
    container.append(root);
    let rows = getMinerUAccounts(zotero);
    let inputs = [];
    const el = (tag, text) => {
        const node = document.createElementNS('http://www.w3.org/1999/xhtml', tag);
        if (text) node.textContent = text;
        return node;
    };
    const read = () => inputs.map(row => ({
        name: row.name.value, apiKey: row.key.value,
        enabled: row.enabled.checked, concurrency: Number(row.count.value),
    }));
    const render = () => {
        root.replaceChildren();
        inputs = [];
        root.append(el('p', translate('accounts.help')));
        rows.forEach((account, index) => {
            const row = el('fieldset');
            row.append(el('legend', `MinerU ${index + 1}`));
            const field = (label, type, value) => {
                const wrap = el('label', translate(label) + ' ');
                const input = el('input');
                input.type = type;
                input.value = value;
                if (type === 'password') input.autocomplete = 'off';
                wrap.append(input);
                row.append(wrap, el('br'));
                return input;
            };
            const name = field('accounts.name', 'text', account.name);
            const key = field('accounts.key', 'password', account.apiKey);
            const enabled = field('accounts.enabled', 'checkbox', '');
            enabled.checked = account.enabled !== false;
            const count = field('accounts.concurrency', 'number', account.concurrency || 3);
            count.min = '1'; count.max = '3'; count.step = '1';
            inputs.push({ name, key, enabled, count });
            const remove = el('button', translate('accounts.remove'));
            remove.type = 'button';
            remove.addEventListener('click', () => { rows = read(); rows.splice(index, 1); render(); });
            row.append(remove);
            root.append(row);
        });
        const add = el('button', translate('accounts.add'));
        add.type = 'button'; add.disabled = rows.length >= 1;
        add.addEventListener('click', () => { rows = read(); if (rows.length < 1) rows.push({ name: '', apiKey: '', enabled: true, concurrency: 3 }); render(); });
        const save = el('button', translate('accounts.save'));
        save.type = 'button';
        const status = el('p'); status.setAttribute('role', 'status');
        save.addEventListener('click', () => {
            try { rows = saveMinerUAccounts(zotero, read()); render(); root.lastChild.textContent = translate('accounts.saved'); }
            catch (error) { status.textContent = error.message; }
        });
        root.append(add, save, status);
    };
    render();
    return root;
}
