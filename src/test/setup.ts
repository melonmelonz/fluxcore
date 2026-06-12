// Node >= 22 ships a stub `localStorage` global that is inert unless Node is
// started with a valid --localstorage-file. Vitest 4 on new Node versions ends
// up exposing that stub even under the jsdom environment, so storage-backed
// code fails with "localStorage.setItem is not a function". Give tests a real
// in-memory implementation instead.
if (typeof globalThis.localStorage?.setItem !== 'function') {
  const store = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    setItem: (k: string, v: string) => void store.set(String(k), String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorage, configurable: true });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: localStorage, configurable: true });
  }
}
