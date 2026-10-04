export const HOUSE_MODEL_RANDOM_MODULUS = 2147483647;
export type HouseModelSort = "random" | "views" | "featured";
export function parseHouseModelSort(value: unknown): HouseModelSort {
  return value === "views" || value === "featured" ? value : "random";
}

// Keep this integer calculation aligned with the SQLite expression in /api/posts.
export function houseModelOrderKey(id: number, seed: number) {
  const value = (BigInt(id) * BigInt(48271) + BigInt(seed)) % BigInt(HOUSE_MODEL_RANDOM_MODULUS);
  return Number(value * value % BigInt(HOUSE_MODEL_RANDOM_MODULUS));
}

export function shuffleHouseModels<T>(items: readonly T[], seed: number): T[] {
  const result = [...items];
  let state = seed || 1;
  for (let index = result.length - 1; index > 0; index--) {
    state = (state * 48271) % HOUSE_MODEL_RANDOM_MODULUS;
    const target = state % (index + 1);
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
