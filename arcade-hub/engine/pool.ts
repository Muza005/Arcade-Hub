// Пул объектов: переиспользование вместо создания в каждом кадре.

export class Pool<T> {
  private readonly free: T[] = [];
  private readonly active = new Set<T>();

  constructor(
    private readonly create: () => T,
    private readonly reset: (item: T) => void,
    prewarm = 0,
  ) {
    for (let i = 0; i < prewarm; i++) this.free.push(create());
  }

  acquire(): T {
    const item = this.free.pop() ?? this.create();
    this.active.add(item);
    return item;
  }

  release(item: T): void {
    if (!this.active.delete(item)) return;
    this.reset(item);
    this.free.push(item);
  }

  releaseAll(): void {
    for (const item of this.active) {
      this.reset(item);
      this.free.push(item);
    }
    this.active.clear();
  }

  forEachActive(fn: (item: T) => void): void {
    for (const item of this.active) fn(item);
  }

  get activeCount(): number {
    return this.active.size;
  }

  get freeCount(): number {
    return this.free.length;
  }
}
