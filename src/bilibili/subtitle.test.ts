import { describe, expect, it } from 'vitest';
import { pickSubtitle, subtitleBodyToText } from './subtitle';

const item = (lan: string) => ({ lan, lan_doc: lan, subtitle_url: `//x/${lan}.json` });

describe('pickSubtitle', () => {
  it('人工字幕優先於 AI 字幕', () => {
    const picked = pickSubtitle([item('ai-zh'), item('en')]);
    expect(picked).toEqual({ item: item('en'), from: 'human' });
  });

  it('人工字幕之中優先中文', () => {
    expect(pickSubtitle([item('en'), item('zh-CN')])?.item.lan).toBe('zh-CN');
  });

  it('沒有人工字幕才退回 AI 字幕，並優先中文', () => {
    const picked = pickSubtitle([item('ai-en'), item('ai-zh')]);
    expect(picked).toEqual({ item: item('ai-zh'), from: 'ai' });
  });

  it('完全沒有字幕就放棄', () => {
    expect(pickSubtitle([])).toBeUndefined();
  });
});

describe('subtitleBodyToText', () => {
  it('串成一行並壓掉多餘空白', () => {
    expect(subtitleBodyToText([{ content: ' 你好 ' }, { content: '' }, { content: '世界\n再見' }])).toBe('你好 世界 再見');
  });
});
