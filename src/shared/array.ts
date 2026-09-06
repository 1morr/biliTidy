/** 依批次大小切分；size 小於 1 時當作 1，避免無窮迴圈 */
export function chunk<T>(items: T[], size: number): T[][] {
  const step = Math.max(1, size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += step) out.push(items.slice(i, i + step));
  return out;
}
