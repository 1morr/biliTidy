import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, isVisionActive, normalizeSettings } from './settings';

describe('settings', () => {
  it('預設值', () => {
    expect(DEFAULT_SETTINGS.ai.batchSizeText).toBe(30);
    expect(DEFAULT_SETTINGS.ai.batchSizeVision).toBe(10);
    expect(DEFAULT_SETTINGS.rate.readRps).toBe(2);
    expect(DEFAULT_SETTINGS.features.fetchSubtitle).toBe(false);
    expect(DEFAULT_SETTINGS.features.fetchDetail).toBe(true);
    expect(DEFAULT_SETTINGS.ai.attachCover).toBe(true);
    expect(DEFAULT_SETTINGS.follows).toEqual({ thresholdDays: 365, includeWhispers: true });
  });

  it('關注的設定：門檻填壞退回預設、不波及悄悄關注；整段不是物件時退回整段', () => {
    const s = normalizeSettings({ follows: { thresholdDays: 'abc', includeWhispers: false } });
    expect(s.follows).toEqual({ thresholdDays: 365, includeWhispers: false });
    expect(normalizeSettings({ follows: { thresholdDays: 180 } }).follows.thresholdDays).toBe(180);
    expect(normalizeSettings({ follows: 'nope', ai: { model: 'x' } }).follows).toEqual(DEFAULT_SETTINGS.follows);
    // 兩個前身的舊設定裡沒有 follows 這一段：補預設，不動其他段
    expect(normalizeSettings({ ai: { model: 'x' } }).follows).toEqual(DEFAULT_SETTINGS.follows);
  });

  it('缺漏欄位補預設、非法欄位退回預設', () => {
    const s = normalizeSettings({ ai: { model: 'x' }, rate: { readRps: 'bad' } });
    expect(s.ai.model).toBe('x');
    expect(s.ai.batchSizeText).toBe(30);
    expect(s.rate).toEqual(DEFAULT_SETTINGS.rate);
  });

  it('一個欄位填壞不會波及同一段的其他欄位（金鑰不可以被清掉）', () => {
    const s = normalizeSettings({
      ai: {
        baseUrl: 'https://api.deepseek.com/v1',
        apiKey: 'sk-real-key',
        model: 'deepseek-v4-flash',
        batchSizeText: 0, // 使用者把欄位清空 → Number('') === 0
        temperature: 5, // 超出 0–2
      },
      rate: { readRps: 0, writeIntervalMs: 1500, moveBatchSize: 20 },
    });
    expect(s.ai.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(s.ai.apiKey).toBe('sk-real-key');
    expect(s.ai.model).toBe('deepseek-v4-flash');
    expect(s.ai.batchSizeText).toBe(30);
    expect(s.ai.temperature).toBeUndefined();
    expect(s.rate.readRps).toBe(2);
    expect(s.rate.writeIntervalMs).toBe(1500);
  });

  it('baseUrl 只允許 https，或本機的 http://localhost／http://127.0.0.1（避免明文送出 API Key）', () => {
    expect(normalizeSettings({ ai: { baseUrl: 'https://api.deepseek.com/v1' } }).ai.baseUrl).toBe('https://api.deepseek.com/v1');
    expect(normalizeSettings({ ai: { baseUrl: 'http://localhost:11434/v1' } }).ai.baseUrl).toBe('http://localhost:11434/v1');
    expect(normalizeSettings({ ai: { baseUrl: 'http://127.0.0.1:1234/v1' } }).ai.baseUrl).toBe('http://127.0.0.1:1234/v1');
    // 其他 http:// 主機（含區網 IP）一律退回預設，不可以讓 Authorization: Bearer <key> 明文送出去
    expect(normalizeSettings({ ai: { baseUrl: 'http://192.168.1.5:1234/v1' } }).ai.baseUrl).toBe(DEFAULT_SETTINGS.ai.baseUrl);
    expect(normalizeSettings({ ai: { baseUrl: 'http://example.com/v1' } }).ai.baseUrl).toBe(DEFAULT_SETTINGS.ai.baseUrl);
    expect(normalizeSettings({ ai: { baseUrl: '不是網址' } }).ai.baseUrl).toBe(DEFAULT_SETTINGS.ai.baseUrl);
  });

  it('整段不是物件時才退回那一段的預設', () => {
    const s = normalizeSettings({ ai: 'broken', features: { fetchSubtitle: true } });
    expect(s.ai).toEqual(DEFAULT_SETTINGS.ai);
    expect(s.features.fetchSubtitle).toBe(true);
  });

  it('丟棄已移除的舊欄位；temperature 預設不送出', () => {
    const s = normalizeSettings({
      ai: { jsonMode: 'json_object', temperature: 0.7 },
      rate: { jitterPct: 0.9 },
      features: { detailTtlDays: 5 },
    });
    expect(s.ai).not.toHaveProperty('jsonMode');
    expect(s.rate).not.toHaveProperty('jitterPct');
    expect(s.features).not.toHaveProperty('detailTtlDays');
    expect(s.ai.temperature).toBe(0.7);
    expect(DEFAULT_SETTINGS.ai.temperature).toBeUndefined();
  });

  it('三選一的舊設定會遷移成開關', () => {
    // smart 是視覺模式下主動選的，翻成「附上」；字幕的 smart 幾乎不觸發，翻成「不抓」
    expect(normalizeSettings({ ai: { coverMode: 'smart' } }).ai.attachCover).toBe(true);
    expect(normalizeSettings({ ai: { coverMode: 'all' } }).ai.attachCover).toBe(true);
    expect(normalizeSettings({ ai: { coverMode: 'off' } }).ai.attachCover).toBe(false);
    expect(normalizeSettings({ features: { subtitleMode: 'all' } }).features.fetchSubtitle).toBe(true);
    expect(normalizeSettings({ features: { subtitleMode: 'smart' } }).features.fetchSubtitle).toBe(false);
    expect(normalizeSettings({ features: { detailMode: 'off' } }).features.fetchDetail).toBe(false);
  });

  it('更早的勾選欄位也能遷移', () => {
    const on = normalizeSettings({ ai: { attachCoverAll: true, smartCovers: true } });
    expect(on.ai.attachCover).toBe(true);
    expect(normalizeSettings({ ai: { attachCoverAll: false, smartCovers: false } }).ai.attachCover).toBe(false);
    expect(normalizeSettings({ features: { detailLevel: 'twoPass' } }).features.fetchDetail).toBe(true);
    expect(normalizeSettings({ features: { detailLevel: 'listOnly' } }).features.fetchDetail).toBe(false);
    // 沒有舊欄位就走預設，不會被遷移邏輯蓋掉
    expect(normalizeSettings({}).ai.attachCover).toBe(true);
    expect(normalizeSettings({}).features.fetchSubtitle).toBe(false);
  });

  it('視覺功能需勾選且驗證通過', () => {
    const s = normalizeSettings({ ai: { visionSupported: true } });
    expect(isVisionActive(s)).toBe(false);
    expect(isVisionActive({ ...s, ai: { ...s.ai, visionVerifiedAt: 1 } })).toBe(true);
  });
});
