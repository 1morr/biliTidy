import { describe, expect, it } from 'vitest';
import type { Settings } from '@/shared/types';
import { buildPromptPreview } from './promptPreview';
import { DEFAULT_SETTINGS } from './settings';

const withVision = (patch: Partial<Settings['ai']>): Settings => ({
  ...DEFAULT_SETTINGS,
  ai: { ...DEFAULT_SETTINGS.ai, visionSupported: true, visionVerifiedAt: 1, ...patch },
});

describe('buildPromptPreview', () => {
  it('完整詳情：標籤與合集都在，沒有圖片', () => {
    const p = buildPromptPreview(DEFAULT_SETTINGS);
    expect(p.user).toContain('標籤：');
    expect(p.user).toContain('合集：');
    expect(p.withImages).toBe(false);
    expect(p.user).not.toContain('封面圖片');
  });

  it('預覽會先給目前所在的收藏夾，再給目標收藏夾', () => {
    const p = buildPromptPreview(DEFAULT_SETTINGS);
    expect(p.user).toContain('【目前所在收藏夾】');
    expect(p.user).toContain('- id=1 名稱：默认收藏夹');
    // 目標夾用的是送給模型的短號，不是 10 位數的 media_id
    expect(p.user).toContain('- id=2 名稱：繪畫 / 美圖');
    expect(p.user).not.toContain('2271580846');
    expect(p.user.indexOf('【目前所在收藏夾】')).toBeLessThan(p.user.indexOf('【目標收藏夾】'));
  });

  it('不抓詳情：沒有標籤與合集', () => {
    const p = buildPromptPreview({
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, fetchDetail: false },
    });
    expect(p.user).not.toContain('標籤：');
    expect(p.user).toContain('標題：');
  });

  it('附上封面：兩支都帶圖', () => {
    const p = buildPromptPreview(withVision({ attachCover: true }));
    expect(p.withImages).toBe(true);
    expect(p.user.match(/封面圖片/g)).toHaveLength(2);
  });

  it('不附圖：純文字', () => {
    const p = buildPromptPreview(withVision({ attachCover: false }));
    expect(p.withImages).toBe(false);
    expect(p.user).not.toContain('封面圖片');
  });

  it('視覺未驗證時不會真的送圖，並說明原因', () => {
    const p = buildPromptPreview({ ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, attachCover: true } });
    expect(p.withImages).toBe(false);
    expect(p.note).toContain("hasn't been verified");
  });

  it('字幕開關會反映在內容與來源標註上', () => {
    const off = buildPromptPreview(DEFAULT_SETTINGS);
    expect(off.user).not.toContain('字幕');
    const on = buildPromptPreview({
      ...DEFAULT_SETTINGS,
      features: { ...DEFAULT_SETTINGS.features, fetchSubtitle: true },
    });
    expect(on.user).toContain('字幕（人工）：');
    expect(on.user).toContain('字幕（AI 生成）：');
  });

  it('不抓詳情時字幕不會出現，並說明原因', () => {
    const p = buildPromptPreview({
      ...DEFAULT_SETTINGS,
      features: { fetchDetail: false, fetchSubtitle: true },
    });
    expect(p.user).not.toContain('字幕');
    expect(p.note).toContain('fetched together with details');
  });

  it('自訂指示會出現在系統提示裡', () => {
    const p = buildPromptPreview({
      ...DEFAULT_SETTINGS,
      ai: { ...DEFAULT_SETTINGS.ai, customInstructions: 'MMD 一律進繪畫夾' },
    });
    expect(p.system).toContain('MMD 一律進繪畫夾');
  });
});
