// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
import { translateEnglish } from '../i18n/localization.js';
import { collectLibraryPDFs } from '../platform/library-markdown.js';
import { isSavedMarkdownNote as isMarkedSavedMarkdownNote } from '../core/saved-markdown-note-format.js';

const ITEM_MENU_ID = 'zotero-itemmenu';
const MENU_ITEM_ID = 'mktero-read-as-markdown';
const LEGACY_GRAPH_MENU_ITEM_ID = 'mktero-open-citation-graph';

export function registerItemContextMenu({
    zotero,
    window,
    rootURI,
    onOpen,
    onImport = null,
    isReady = null,
    onBatch = null,
    onStopBatch = null,
    isBatchRunning = () => false,
    onOpenSavedNote = null,
    isSavedMarkdownNote = defaultIsSavedMarkdownNote,
    onError,
    translate = translateEnglish,
}) {
    const document = window?.document;
    const menu = document?.getElementById?.(ITEM_MENU_ID);
    if (!menu) return null;

    document.getElementById(MENU_ITEM_ID)?.remove();
    // Remove the item injected by older builds that exposed the graph here.
    document.getElementById(LEGACY_GRAPH_MENU_ITEM_ID)?.remove();

    const menuItem = document.createXULElement?.('menuitem')
        || document.createElement('menuitem');
    menuItem.id = MENU_ITEM_ID;
    menuItem.hidden = true;
    menuItem.setAttribute('label', translate('menu.readAsMarkdown'));

    const importItem = document.createXULElement?.('menuitem') || document.createElement('menuitem');
    importItem.id = 'mktero-import-local';
    importItem.setAttribute('label', translate('library.import'));
    importItem.hidden = true;
    const handleImport = () => {
        const selected = resolveSelectedItem(zotero, window, isSavedMarkdownNote);
        if (selected?.kind === 'pdf' && onImport) {
            Promise.resolve().then(() => onImport(selected.item.id)).catch(onError);
        }
    };
    importItem.addEventListener('command', handleImport);
    if (onImport) menu.append(importItem);
    const batchItem = document.createXULElement?.('menuitem') || document.createElement('menuitem');
    batchItem.id = 'mktero-batch-convert';
    batchItem.hidden = true;
    const stopItem = document.createXULElement?.('menuitem') || document.createElement('menuitem');
    stopItem.id = 'mktero-batch-stop';
    stopItem.hidden = true;
    stopItem.setAttribute('label', translate('batch.stop'));
    const selectedPDFs = () => collectLibraryPDFs(zotero, window?.ZoteroPane?.getSelectedItems?.() || []);
    const handleBatch = () => {
        const ids = selectedPDFs().map(pdf => pdf.id);
        if (ids.length && !isBatchRunning()) Promise.resolve().then(() => onBatch?.(ids)).catch(onError);
    };
    const handleStop = () => onStopBatch?.();
    batchItem.addEventListener('command', handleBatch);
    stopItem.addEventListener('command', handleStop);
    if (onBatch) menu.append(batchItem, stopItem);
    const handlePopupShowing = event => {
        if (event.target !== menu) return;
        const count = selectedPDFs().length;
        batchItem.hidden = !onBatch || !count;
        batchItem.disabled = isBatchRunning();
        batchItem.setAttribute('label', translate('batch.convert', { count }));
        stopItem.hidden = !onStopBatch || !isBatchRunning();
        const selected = resolveSelectedItem(
            zotero,
            window,
            isSavedMarkdownNote
        );
        importItem.hidden = !onImport || selected?.kind !== 'pdf';
        menuItem.hidden = !selected
            || (selected.kind === 'saved-markdown-note'
                && typeof onOpenSavedNote !== 'function');
        menuItem.setAttribute(
            'label',
            translate(selected?.kind === 'saved-markdown-note'
                ? 'menu.openSavedMarkdown'
                : isReady ? (isReady(selected?.item.id) ? 'library.open' : 'library.convert') : 'menu.readAsMarkdown')
        );
    };
    const handleCommand = () => {
        const selected = resolveSelectedItem(
            zotero,
            window,
            isSavedMarkdownNote
        );
        if (!selected) return;
        Promise.resolve()
            .then(() => selected.kind === 'saved-markdown-note'
                ? onOpenSavedNote?.(selected.item.id)
                : onOpen(selected.item.id))
            .catch(onError);
    };
    menu.addEventListener('popupshowing', handlePopupShowing);
    menuItem.addEventListener('command', handleCommand);
    menu.append(menuItem);

    let active = true;
    return () => {
        if (!active) return;
        active = false;
        menu.removeEventListener('popupshowing', handlePopupShowing);
        menuItem.removeEventListener('command', handleCommand);
        menuItem.remove();
        importItem.removeEventListener('command', handleImport);
        importItem.remove();
        batchItem.removeEventListener('command', handleBatch);
        stopItem.removeEventListener('command', handleStop);
        batchItem.remove();
        stopItem.remove();
    };
}

function resolveSelectedItem(zotero, window, isSavedMarkdownNote) {
    const selectedItems = window?.ZoteroPane?.getSelectedItems?.();
    if (!Array.isArray(selectedItems) || selectedItems.length !== 1) return null;

    const item = selectedItems[0];
    if (isSavedMarkdownNote(item)) {
        return { kind: 'saved-markdown-note', item };
    }
    if (item?.isPDFAttachment?.()) return { kind: 'pdf', item };
    if (!item?.isRegularItem?.()) return null;

    for (const attachmentID of item.getAttachments?.() || []) {
        const attachment = zotero?.Items?.get?.(attachmentID);
        if (attachment?.isPDFAttachment?.()) {
            return { kind: 'pdf', item: attachment };
        }
    }
    return null;
}

function defaultIsSavedMarkdownNote(item) {
    return Boolean(item?.isNote?.()
        && isMarkedSavedMarkdownNote(item.getNote?.() || ''));
}
