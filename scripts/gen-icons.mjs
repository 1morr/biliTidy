// 產生 public/icon/{16,32,48,128}.png：粉色圓底＋白色勾號。純 Node（zlib），不需外部套件。
// 兩個前身（biliFavOrg 資料夾、biliFollowCleaner 人像）同一個粉色圓底；合併後換成一個勾——
// 「先審核、再動手」是兩個功能共同的核心，與頂列的品牌記號（ui/components/icons.tsx 的 IconBrand）同一個符號。
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

const crcTable = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** 勾號在單位正方形裡的幾何：兩段圓端線段（短的往左下、長的往右上），以到線段的距離判定 */
function glyph(u, v) {
  const w = 0.075; // 線寬的一半（相對邊長）
  const seg = (ax, ay, bx, by) => {
    const dx = bx - ax;
    const dy = by - ay;
    const tt = Math.max(0, Math.min(1, ((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(u - (ax + tt * dx), v - (ay + tt * dy)) <= w;
  };
  return seg(0.3, 0.52, 0.45, 0.67) || seg(0.45, 0.67, 0.72, 0.36);
}

function render(size) {
  const px = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const r = size / 2 - 0.5;
  const SS = 4; // 4×4 超取樣，讓小尺寸的符號邊緣不鋸齒
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let inside = 0;
      let white = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px1 = x + (sx + 0.5) / SS;
          const py1 = y + (sy + 0.5) / SS;
          if (Math.hypot(px1 - c, py1 - c) > r) continue;
          inside++;
          if (glyph(px1 / size, py1 / size)) white++;
        }
      }
      if (inside === 0) continue;
      const a = inside / (SS * SS);
      const wv = white / inside;
      // 粉底與白符號依覆蓋率混色
      px[i] = Math.round(0xfb + (255 - 0xfb) * wv);
      px[i + 1] = Math.round(0x72 + (255 - 0x72) * wv);
      px[i + 2] = Math.round(0x99 + (255 - 0x99) * wv);
      px[i + 3] = Math.round(a * 255);
    }
  }
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('public/icon', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icon/${s}.png`, render(s));
console.log('icons written');
