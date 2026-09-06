import { describe, expect, it } from 'vitest';
import type { Settings } from '@/shared/types';
import { planFlow, type FlowStep } from './flow';
import { DEFAULT_SETTINGS } from './settings';

const stepOf = (steps: FlowStep[], key: string): FlowStep => {
  const s = steps.find((x) => x.key === key);
  if (!s) throw new Error(`no step ${key}`);
  return s;
};

const withVision = (patch: Partial<Settings['ai']>): Settings => ({
  ...DEFAULT_SETTINGS,
  ai: { ...DEFAULT_SETTINGS.ai, visionSupported: true, visionVerifiedAt: 1, ...patch },
});

const withFeat = (patch: Partial<Settings['features']>): Settings => ({
  ...DEFAULT_SETTINGS,
  features: { ...DEFAULT_SETTINGS.features, ...patch },
});

describe('planFlow', () => {
  it('預設：抓詳情、不抓字幕、不附圖', () => {
    const steps = planFlow(DEFAULT_SETTINGS);
    expect(stepOf(steps, 'detail').active).toBe(true);
    expect(stepOf(steps, 'subtitle').active).toBe(false);
    expect(stepOf(steps, 'subtitle').title).toBe('Fetch subtitles');
    expect(stepOf(steps, 'cover').active).toBe(false);
    expect(stepOf(steps, 'classify').detail).toContain(`${DEFAULT_SETTINGS.ai.batchSizeText} per batch`);
  });

  it('不抓詳情時該步驟標成略過', () => {
    const steps = planFlow(withFeat({ fetchDetail: false }));
    expect(stepOf(steps, 'detail').active).toBe(false);
  });

  it('不抓詳情時字幕步驟一併標成略過', () => {
    const steps = planFlow(withFeat({ fetchDetail: false, fetchSubtitle: true }));
    expect(stepOf(steps, 'subtitle').active).toBe(false);
    expect(stepOf(steps, 'subtitle').detail).toContain('video detail');
  });

  it('附上封面：封面步驟啟用，分類改用視覺批次', () => {
    const s = withVision({ attachCover: true });
    const steps = planFlow(s);
    expect(stepOf(steps, 'cover').active).toBe(true);
    const detail = stepOf(steps, 'classify').detail;
    expect(detail).toContain(`${s.ai.batchSizeVision} per batch`);
    expect(detail).not.toContain(`${s.ai.batchSizeText} per batch`);
  });

  it('視覺未驗證時封面步驟不會啟用', () => {
    const s: Settings = { ...DEFAULT_SETTINGS, ai: { ...DEFAULT_SETTINGS.ai, attachCover: true } };
    expect(stepOf(planFlow(s), 'cover').active).toBe(false);
    expect(stepOf(planFlow(s), 'cover').detail).toContain('Vision mode');
  });

  it('invalid 排在 list 之後、detail 之前，對齊 organizer.ts 的真正執行順序', () => {
    const keys = planFlow(DEFAULT_SETTINGS).map((s) => s.key);
    expect(keys.indexOf('invalid')).toBe(keys.indexOf('list') + 1);
    expect(keys.indexOf('invalid')).toBeLessThan(keys.indexOf('detail'));
  });

  it('每一步都有標題與說明', () => {
    for (const step of planFlow(DEFAULT_SETTINGS)) {
      expect(step.title.length).toBeGreaterThan(0);
      expect(step.detail.length).toBeGreaterThan(0);
    }
  });
});
