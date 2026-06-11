/** RT price at or above which the UI shifts into storm mode ($/MWh). */
export const STORM_PRICE = 500;

export function isStorm(price: number | null | undefined): boolean {
  return typeof price === 'number' && price >= STORM_PRICE;
}
