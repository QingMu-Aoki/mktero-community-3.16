// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
// Ignore PDF compression, metadata and generated font IDs, but require the
// same page geometry and every text item's content and coordinates.
export function equivalentPDFLayouts(left, right) {
    if (!left?.pages?.length || left.pages.length !== right?.pages?.length) return false;
    return left.pages.every((page, index) => {
        const other = right.pages[index];
        if (!page.normalizedText?.trim() || page.normalizedText !== other.normalizedText) return false;
        if (!near(page.viewport?.width, other.viewport?.width)
            || !near(page.viewport?.height, other.viewport?.height)
            || !sameNumbers(page.viewport?.transform, other.viewport?.transform)) return false;
        if (!page.items?.length || page.items.length !== other.items?.length) return false;
        return page.items.every((item, i) => {
            const candidate = other.items[i];
            return item.text === candidate.text && item.direction === candidate.direction
                && near(item.width, candidate.width) && near(item.height, candidate.height)
                && sameNumbers(item.transform, candidate.transform);
        });
    });
}

function near(a, b) {
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 0.01;
}

function sameNumbers(a, b) {
    return Array.isArray(a) && a.length > 0 && a.length === b?.length
        && a.every((value, i) => near(value, b[i]));
}
