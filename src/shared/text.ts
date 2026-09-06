/** 壓掉連續空白後截斷，超長的補上刪節號；prompt 的每個文字欄位都經過它 */
export function clip(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
