// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one to
// mount. Charts render at zero size in tests, which is fine — the snapshots
// cover the figures and text, not the chart drawing.
if (typeof window !== 'undefined' && !('ResizeObserver' in window)) {
  (window as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

// Node 25 ships its own global localStorage, which shadows jsdom's and throws
// unless Node is started with --localstorage-file. Swap in a plain in-memory
// Storage so useTaxConfig behaves as it does in a browser.
if (typeof window !== 'undefined') {
  const store = new Map<string, string>();
  const memoryStorage = {
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => store.clear(),
  };
  Object.defineProperty(globalThis, 'localStorage', { value: memoryStorage, configurable: true });
}
