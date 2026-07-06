/**
 * Binary min-heap keyed by a numeric priority. Used as Dijkstra's frontier.
 * Stores (priority, value) pairs; `pop` returns the lowest-priority value.
 */
export class MinHeap<T> {
  private items: Array<{ p: number; v: T }> = [];

  get size(): number {
    return this.items.length;
  }

  push(priority: number, value: T): void {
    const items = this.items;
    items.push({ p: priority, v: value });
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (items[parent].p <= items[i].p) break;
      [items[parent], items[i]] = [items[i], items[parent]];
      i = parent;
    }
  }

  pop(): T | undefined {
    const items = this.items;
    if (items.length === 0) return undefined;
    const top = items[0];
    const last = items.pop()!;
    if (items.length > 0) {
      items[0] = last;
      let i = 0;
      const n = items.length;
      for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        let smallest = i;
        if (l < n && items[l].p < items[smallest].p) smallest = l;
        if (r < n && items[r].p < items[smallest].p) smallest = r;
        if (smallest === i) break;
        [items[smallest], items[i]] = [items[i], items[smallest]];
        i = smallest;
      }
    }
    return top.v;
  }
}
