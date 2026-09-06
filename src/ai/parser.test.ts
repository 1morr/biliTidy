import { describe, expect, it } from 'vitest';
import { parseClassification, toBasisList } from './parser';

const valid = new Set([1, 2]);

describe('parseClassification', () => {
  it('標準 {results:[…]} 格式', () => {
    const r = parseClassification(
      '{"results":[{"bvid":"BVa","target_folder_ids":[1],"reason":"r","confidence":"high"}]}',
      ['BVa'],
      valid,
    );
    expect(r.items).toEqual([{ bvid: 'BVa', targetFolderIds: [1], reason: 'r' }]);
    expect(r.parseError).toBeUndefined();
  });

  it('圍欄只砍開頭結尾，不動 reason 字串裡自己的反引號（曾經被全域 replace 誤砍）', () => {
    const r = parseClassification(
      '```json\n{"results":[{"bvid":"BVa","target_folder_ids":[1],"reason":"用 ```javascript``` 舉例"}]}\n```',
      ['BVa'],
      valid,
    );
    expect(r.items[0]?.reason).toBe('用 ```javascript``` 舉例');
  });

  it('容忍 ```json 圍欄與前後廢話、裸陣列、舊格式 target_folder_id', () => {
    const r = parseClassification(
      '好的，結果如下：\n```json\n[{"bvid":"BVa","target_folder_id":2,"reason":"x"}]\n```\n以上。',
      ['BVa'],
      valid,
    );
    expect(r.items[0]?.targetFolderIds).toEqual([2]);
  });

  it('缺 bvid 補成保持原位；多餘 bvid 忽略；清單外的 folder id 被丟掉', () => {
    const r = parseClassification(
      '{"results":[{"bvid":"BVb","target_folder_ids":[1,99],"reason":"x","confidence":"low"},{"bvid":"BVz","target_folder_ids":[1]}]}',
      ['BVa', 'BVb'],
      valid,
    );
    expect(r.items.map((i) => i.bvid)).toEqual(['BVa', 'BVb']);
    expect(r.items[0]?.targetFolderIds).toEqual([]);
    expect(r.items[0]?.lowConfidence).toBe(true);
    // 99 不在允許清單裡，只留下 1
    expect(r.items[1]).toEqual({ bvid: 'BVb', targetFolderIds: [1], reason: 'x', lowConfidence: true });
  });

  it('完全不是 JSON → 全部保持原位並回報 parseError', () => {
    const r = parseClassification('抱歉我做不到', ['BVa'], valid);
    expect(r.parseError).toBeDefined();
    expect(r.items[0]?.targetFolderIds).toEqual([]);
  });
  it('解析 basis：正規化、去重、最多 3 個、擋掉自己發明的欄位', () => {
    const r = parseClassification(
      '{"results":[{"bvid":"BVa","target_folder_ids":[1],"basis":["標籤","封面圖","標籤","分區","UP主","星座"],"reason":"x"}]}',
      ['BVa'],
      valid,
    );
    expect(r.items[0]?.basis).toEqual(['標籤', '封面', '分區']);
  });

  it('basis 是字串或缺漏時不會壞掉', () => {
    expect(toBasisList('標籤、合集')).toEqual(['標籤', '合集']);
    expect(toBasisList(undefined)).toEqual([]);
    expect(toBasisList(['沒有這個'])).toEqual([]);
  });
});
