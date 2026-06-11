import type { PricePoint } from './types';

export class MarketClock {
  private i = -1;

  constructor(private readonly points: PricePoint[]) {}

  get done(): boolean {
    return this.i >= this.points.length - 1;
  }

  get progress(): number {
    return this.points.length === 0 ? 1 : (this.i + 1) / this.points.length;
  }

  current(): PricePoint | undefined {
    return this.i >= 0 ? this.points[this.i] : undefined;
  }

  next(): PricePoint | undefined {
    if (this.done) return undefined;
    this.i += 1;
    return this.points[this.i];
  }

  history(): PricePoint[] {
    return this.points.slice(0, this.i + 1);
  }

  reset(): void {
    this.i = -1;
  }
}
