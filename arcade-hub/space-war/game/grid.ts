// Сетка столкновений: камни раскладываются по ячейкам, корабль проверяет только соседние.
export interface GridItem {
  pos: { x: number; y: number };
  radius: number;
}

export class Grid<T extends GridItem> {
  private readonly cells = new Map<number, T[]>();
  private readonly cols: number;

  constructor(
    private readonly cell: number,
    width: number,
    private readonly offset: number,
  ) {
    // Ключ — номер ячейки в строке; камни за краем (offset) тоже попадают в сетку.
    this.cols = Math.ceil((width + offset * 2) / cell) + 1;
  }

  private key(cx: number, cy: number): number {
    return cy * this.cols + cx;
  }

  private index(v: number): number {
    return Math.floor((v + this.offset) / this.cell);
  }

  clear(): void {
    for (const list of this.cells.values()) list.length = 0;
  }

  insert(item: T): void {
    const x0 = this.index(item.pos.x - item.radius);
    const x1 = this.index(item.pos.x + item.radius);
    const y0 = this.index(item.pos.y - item.radius);
    const y1 = this.index(item.pos.y + item.radius);
    for (let cy = y0; cy <= y1; cy++) {
      for (let cx = x0; cx <= x1; cx++) {
        const k = this.key(cx, cy);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(item);
      }
    }
  }

  /** Все камни, чьи ячейки задевает круг (x, y, r). Без повторов, в порядке вставки. */
  query(x: number, y: number, r: number, out: T[]): T[] {
    out.length = 0;
    const seen = new Set<T>();
    for (let cy = this.index(y - r); cy <= this.index(y + r); cy++) {
      for (let cx = this.index(x - r); cx <= this.index(x + r); cx++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const item of list) {
          if (seen.has(item)) continue;
          seen.add(item);
          out.push(item);
        }
      }
    }
    return out;
  }
}
