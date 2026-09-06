import { describe, expect, it } from 'vitest';
import type { Settings } from '@/shared/types';
import { estimateRun, type Estimate } from './estimate';
import { DEFAULT_SETTINGS } from './settings';

const countOf = (e: Estimate, key: string): number => e.rows.find((r) => r.key === key)?.count ?? -1;

const withVision = (patch: Partial<Settings['ai']>): Settings => ({
  ...DEFAULT_SETTINGS,
  ai: { ...DEFAULT_SETTINGS.ai, visionSupported: true, visionVerifiedAt: 1, ...patch },
});

const withFeat = (patch: Partial<Settings['features']>): Settings => ({
  ...DEFAULT_SETTINGS,
  features: { ...DEFAULT_SETTINGS.features, ...patch },
});

describe('estimateRun', () => {
  it('預設：列表分頁 + 每支一次詳情，不抓字幕也不附圖', () => {
    const e = estimateRun(2234, DEFAULT_SETTINGS);
    // 一頁不保證回滿 40 支，以每頁 30 支估
    expect(countOf(e, 'list')).toBe(75);
    expect(countOf(e, 'detail')).toBe(2234);
    // 合計 = nav 1 + 收藏夾清單 1 + 列表 75 + 詳情 2234（搬移不計入）
    expect(e.biliRequests).toBe(2 + 75 + 2234);
    expect(countOf(e, 'subtitle')).toBe(0);
    expect(countOf(e, 'cover')).toBe(0);
    expect(e.aiCalls).toBe(75);
    expect(e.minutes).toBe(20);
  });

  it('限制數量後請求數等比下降', () => {
    const e = estimateRun(100, DEFAULT_SETTINGS);
    expect(countOf(e, 'list')).toBe(4);
    expect(countOf(e, 'detail')).toBe(100);
    expect(e.aiCalls).toBe(4);
    expect(e.minutes).toBe(1);
  });

  it('不抓詳情時只剩列表請求', () => {
    const e = estimateRun(100, withFeat({ fetchDetail: false }));
    expect(countOf(e, 'detail')).toBe(0);
    expect(e.biliRequests).toBe(2 + 4);
    expect(e.aiCalls).toBe(4);
  });

  it('抓字幕：每支 2 次', () => {
    const e = estimateRun(100, withFeat({ fetchSubtitle: true }));
    expect(countOf(e, 'subtitle')).toBe(200);
    expect(e.biliRequests).toBe(2 + 4 + 100 + 200);
  });

  it('不抓詳情時字幕也不會抓', () => {
    const e = estimateRun(100, withFeat({ fetchDetail: false, fetchSubtitle: true }));
    expect(countOf(e, 'subtitle')).toBe(0);
    expect(e.biliRequests).toBe(2 + 4);
    expect(e.rows.find((r) => r.key === 'subtitle')?.note).toContain('video detail');
  });

  it('視覺未驗證時不計封面', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, attachCover: true } };
    expect(countOf(estimateRun(50, s), 'cover')).toBe(0);
    expect(estimateRun(50, s).rows.find((r) => r.key === 'cover')?.note).toContain('Vision mode');
  });

  it('附上封面：每支一張，批次改用視覺批次大小', () => {
    const e = estimateRun(50, withVision({ attachCover: true }));
    expect(countOf(e, 'cover')).toBe(50);
    expect(e.cdnRequests).toBe(50);
    expect(e.aiCalls).toBe(5);
  });

  it('不附圖：沒有 CDN 請求，批次用文字批次大小', () => {
    const e = estimateRun(50, withVision({ attachCover: false }));
    expect(countOf(e, 'cover')).toBe(0);
    expect(e.cdnRequests).toBe(0);
    expect(e.aiCalls).toBe(2);
  });

  it('合計等於逐項表裡的 B 站列加總（搬移除外）', () => {
    // 成本卡顯示 biliRequests、下面的明細顯示每一列；兩者對不起來時使用者會以為數字是錯的
    for (const s of [DEFAULT_SETTINGS, withFeat({ fetchSubtitle: true }), withVision({ attachCover: true })]) {
      const e = estimateRun(100, s);
      const summed = e.rows.filter((r) => r.kind === 'bili' && r.key !== 'move').reduce((n, r) => n + r.count, 0);
      expect(e.biliRequests).toBe(summed);
    }
  });

  it('每一列都有用途說明', () => {
    for (const row of estimateRun(100, DEFAULT_SETTINGS).rows) {
      expect(row.purpose.length).toBeGreaterThan(0);
      expect(row.endpoint.length).toBeGreaterThan(0);
    }
  });
});
