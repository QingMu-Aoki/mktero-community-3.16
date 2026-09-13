// Community additions and modifications: Copyright (c) 2026 青木 · Aoki
// Each reader/batch subscriber owns its cancellation; abort underlying work only
// when nobody still needs it. Progress is broadcast without opening any tabs.
export class SharedConversions {
    constructor(createController) { this.createController = createController; this.runs = new Map(); }
    run(id, options, execute) {
        if (options.signal?.aborted) return Promise.reject(options.signal.reason || new Error('Cancelled'));
        let run = this.runs.get(id);
        if (run?.controller.signal.aborted) {
            return run.promise.catch(() => {}).then(() => this.run(id, options, execute));
        }
        if (!run) {
            run = { controller: this.createController(), listeners: new Set() };
            this.runs.set(id, run);
            run.promise = Promise.resolve().then(() => execute({
                ...options, signal: run.controller.signal,
                onProgress: (...args) => { for (const listener of run.listeners) listener.progress?.(...args); },
            })).finally(() => { if (this.runs.get(id) === run) this.runs.delete(id); });
        }
        return new Promise((resolve, reject) => {
            const listener = { progress: options.onProgress };
            const cleanup = () => { run.listeners.delete(listener); options.signal?.removeEventListener('abort', abort); };
            const abort = () => {
                cleanup(); reject(options.signal.reason || new Error('Cancelled'));
                if (!run.listeners.size) {
                    run.controller.abort();
                }
            };
            run.listeners.add(listener);
            options.signal?.addEventListener('abort', abort, { once: true });
            run.promise.then(value => { cleanup(); resolve(value); }, error => { cleanup(); reject(error); });
        });
    }
    dispose() { for (const run of this.runs.values()) run.controller.abort(); this.runs.clear(); }
}
