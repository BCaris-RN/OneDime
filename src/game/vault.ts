export const VAULT_TILE_COUNT = 100;
export function vaultTileCount(input: { matchedCents: number; distinctWorkDays: number; completedQuests: number }) {
  const questTiles = input.matchedCents > 0 ? Math.max(0, input.completedQuests) * 3 : 0;
  return Math.min(VAULT_TILE_COUNT, Math.max(0, Math.floor(input.matchedCents / 100) * 2 + Math.max(0, input.distinctWorkDays) + questTiles));
}
export const TILE_ORDER = (() => {
  const order = Array.from({ length: VAULT_TILE_COUNT }, (_, index) => index); let seed = 42;
  for (let index = order.length - 1; index > 0; index--) { seed = (seed * 1103515245 + 12345) % 2147483648; const swap = seed % (index + 1); [order[index], order[swap]] = [order[swap], order[index]]; }
  return order;
})();
export function vaultSeenCount(seen: number, tiles: number) { return Math.min(VAULT_TILE_COUNT, Math.max(0, Math.max(seen, tiles))); }
