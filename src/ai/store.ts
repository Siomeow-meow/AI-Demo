/** Tiny persistent store that works with React's useSyncExternalStore. */
export function createStore<T>(key: string, initial: T) {
  let value: T = initial
  try {
    const raw = localStorage.getItem(key)
    if (raw) value = JSON.parse(raw) as T
  } catch {
    /* storage unavailable: start from the initial value */
  }
  const listeners = new Set<() => void>()

  return {
    get: () => value,
    /** Returns false if the value could not be saved to browser storage (e.g. too large); it stays in memory. */
    set(next: T): boolean {
      value = next
      let saved = true
      try {
        localStorage.setItem(key, JSON.stringify(value))
      } catch {
        saved = false
      }
      listeners.forEach((l) => l())
      return saved
    },
    subscribe(cb: () => void) {
      listeners.add(cb)
      return () => {
        listeners.delete(cb)
      }
    },
  }
}
