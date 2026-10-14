/** Bounded, tab-local response cache. Never persists private data to browser storage. */
export class MemoryCache<K, T> {
  private entries = new Map<K, { value: T; at: number; bytes: number }>()
  private bytes = 0
  constructor(
    private maxEntries: number,
    private maxBytes: number,
    private maxAge: number,
  ) {}
  get(key: K, maxAge = this.maxAge) {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (Date.now() - entry.at >= this.maxAge) {
      this.delete(key)
      return undefined
    }
    if (Date.now() - entry.at >= maxAge) return undefined
    this.entries.delete(key)
    this.entries.set(key, entry)
    return entry.value
  }
  set(key: K, value: T) {
    const bytes = new TextEncoder().encode(JSON.stringify(value)).byteLength
    this.delete(key)
    if (bytes > this.maxBytes) return
    while (this.entries.size >= this.maxEntries || this.bytes + bytes > this.maxBytes)
      this.delete(this.entries.keys().next().value!)
    this.entries.set(key, { value, at: Date.now(), bytes })
    this.bytes += bytes
  }
  delete(key: K) {
    this.bytes -= this.entries.get(key)?.bytes ?? 0
    this.entries.delete(key)
  }
  clear() {
    this.entries.clear()
    this.bytes = 0
  }
}
