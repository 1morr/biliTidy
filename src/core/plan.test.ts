import { describe, expect, it } from 'vitest';
import type { Settings } from '@/shared/types';
import { planOf } from './plan';
import { DEFAULT_SETTINGS } from './settings';

const withFeat = (patch: Partial<Settings['features']>): Settings => ({
  ...DEFAULT_SETTINGS,
  features: { ...DEFAULT_SETTINGS.features, ...patch },
});

const withAi = (patch: Partial<Settings['ai']>): Settings => ({
  ...DEFAULT_SETTINGS,
  ai: { ...DEFAULT_SETTINGS.ai, ...patch },
});

const withVision = (patch: Partial<Settings['ai']> = {}): Settings =>
  withAi({ visionSupported: true, visionVerifiedAt: 1, ...patch });

describe('planOf', () => {
  it('預設：抓詳情、不抓字幕、不附圖，用文字批次大小', () => {
    const p = planOf(DEFAULT_SETTINGS);
    expect(p.withDetail).toBe(true);
    expect(p.withSubtitle).toBe(false);
    expect(p.withCover).toBe(false);
    expect(p.visionActive).toBe(false);
    expect(p.batchSize).toBe(DEFAULT_SETTINGS.ai.batchSizeText);
  });

  it('字幕跟著詳情走：詳情關掉時字幕一定不抓', () => {
    // 設定頁的勾選框只是 disabled，值不會被清掉，所以這個組合真的會出現：
    // 先開字幕、再關詳情。整理流程一直是這樣，影片頁曾經只看 fetchSubtitle 而多打 2 次請求。
    expect(planOf(withFeat({ fetchSubtitle: true })).withSubtitle).toBe(true);
    expect(planOf(withFeat({ fetchDetail: false, fetchSubtitle: true })).withSubtitle).toBe(false);
    expect(planOf(withFeat({ fetchDetail: false })).withDetail).toBe(false);
  });

  it('附圖要視覺驗證通過才算數，批次大小跟著切換', () => {
    // 勾了「附上封面」但沒通過測試視覺：不附圖，批次仍用文字的
    const unverified = planOf(withAi({ attachCover: true }));
    expect(unverified.visionActive).toBe(false);
    expect(unverified.withCover).toBe(false);
    expect(unverified.batchSize).toBe(DEFAULT_SETTINGS.ai.batchSizeText);

    const verified = planOf(withVision({ attachCover: true }));
    expect(verified.visionActive).toBe(true);
    expect(verified.withCover).toBe(true);
    expect(verified.batchSize).toBe(DEFAULT_SETTINGS.ai.batchSizeVision);

    // 視覺通過但選擇不附圖：批次回到文字的那個數值
    expect(planOf(withVision({ attachCover: false })).batchSize).toBe(DEFAULT_SETTINGS.ai.batchSizeText);
  });

  it('批次大小至少是 1', () => {
    expect(planOf(withAi({ batchSizeText: 0 })).batchSize).toBe(1);
  });

  it('aiReady 要端點與模型都填了', () => {
    expect(planOf(DEFAULT_SETTINGS).aiReady).toBe(true);
    expect(planOf(withAi({ baseUrl: '  ' })).aiReady).toBe(false);
    expect(planOf(withAi({ model: '' })).aiReady).toBe(false);
  });

  it('needsApiKey：遠端端點沒填金鑰才算，本機模型不算', () => {
    // 預設就是這個狀況：端點與模型有值（schema 預設），金鑰空的——「叫得動」但一定拿到 401
    expect(planOf(DEFAULT_SETTINGS).needsApiKey).toBe(true);
    expect(planOf(withAi({ apiKey: 'sk-x' })).needsApiKey).toBe(false);
    expect(planOf(withAi({ apiKey: '   ' })).needsApiKey).toBe(true);
    // 本機模型（ollama／LM Studio）多半不收金鑰，不可以因此擋住整理
    expect(planOf(withAi({ baseUrl: 'http://localhost:11434/v1' })).needsApiKey).toBe(false);
    expect(planOf(withAi({ baseUrl: 'http://127.0.0.1:1234/v1' })).needsApiKey).toBe(false);
    // 還沒填端點的時候由 aiReady 負責說明，不要同時跳兩句話
    expect(planOf(withAi({ baseUrl: '' })).needsApiKey).toBe(false);
  });
});
