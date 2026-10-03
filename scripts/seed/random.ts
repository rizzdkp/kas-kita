/** RNG ber-seed (mulberry32) supaya seed menghasilkan data yang sama setiap dijalankan. */
export class SeededRandom {
  private state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  /** Nominal rupiah acak dibulatkan ke kelipatan `step` (harga di Indonesia jarang tidak bulat). */
  amount(min: number, max: number, step = 500): bigint {
    return BigInt(Math.round(this.int(min, max) / step) * step);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }
}
