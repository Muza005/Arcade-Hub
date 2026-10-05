// Смешение цветов '#RRGGBB': k = 0 — первый, 1 — второй.
const HEX = 16;
const BYTE = 255;
const parse = (c: string): [number, number, number] => {
  const n = parseInt(c.replace('#', ''), HEX);
  return [(n >> 16) & BYTE, (n >> 8) & BYTE, n & BYTE];
};

export function mixColor(a: string, b: string, k: number): string {
  const t = Math.min(1, Math.max(0, k));
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const ch = (x: number, y: number): string => Math.round(x + (y - x) * t).toString(HEX).padStart(2, '0');
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}
