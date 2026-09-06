import { describe, expect, it } from 'vitest';
import {
  DESCRIBE_MAX_CHARS,
  DESCRIBE_SAMPLE_MAX,
  DESCRIBE_SYSTEM_PROMPT,
  buildDescribeUserText,
  cleanDescription,
  type DescribeSample,
} from './describe';

const samples = (n: number): DescribeSample[] => Array.from({ length: n }, (_, i) => ({ title: `影片${i + 1}` }));

describe('buildDescribeUserText', () => {
  it('帶上收藏夾名稱與編號過的影片清單', () => {
    const text = buildDescribeUserText({
      folderTitle: 'Pic',
      samples: [{ title: '插畫過程', intro: '一張圖' }, { title: '手書' }],
    });
    expect(text).toContain('收藏夾名稱：Pic');
    expect(text).toContain('1. 插畫過程（簡介：一張圖）');
    expect(text).toContain('2. 手書');
  });

  it('樣本數超過上限就截斷，數量說明跟著截斷後的數字', () => {
    const text = buildDescribeUserText({ folderTitle: 'X', samples: samples(DESCRIBE_SAMPLE_MAX + 10) });
    expect(text).toContain(`夾子裡的 ${DESCRIBE_SAMPLE_MAX} 支影片`);
    expect(text).not.toContain(`${DESCRIBE_SAMPLE_MAX + 1}. `);
  });

  it('樣本只是收藏夾的一部分時說明是平均取樣，避免模型當成全部', () => {
    const text = buildDescribeUserText({ folderTitle: 'Sound', samples: samples(80), totalCount: 640 });
    expect(text).toContain('從全部 640 支裡平均取樣的 80 支影片');
  });

  it('有現有描述就一起送，讓模型沿用原本的收錄意圖', () => {
    const text = buildDescribeUserText({ folderTitle: 'Sound', samples: samples(2), current: '收所有音聲' });
    expect(text).toContain('使用者原本寫的描述：收所有音聲');
  });

  it('沒有現有描述就不留空欄位', () => {
    const text = buildDescribeUserText({ folderTitle: 'Sound', samples: samples(2), current: '  ' });
    expect(text).not.toContain('使用者原本寫的描述');
  });

  it('過長的標題與簡介會被縮短', () => {
    const text = buildDescribeUserText({ folderTitle: 'X', samples: [{ title: 'a'.repeat(200), intro: 'b'.repeat(200) }] });
    expect(text).toContain('…');
    expect(text).not.toContain('a'.repeat(81));
    expect(text).not.toContain('b'.repeat(61));
  });
});

describe('cleanDescription', () => {
  it('拿掉圍欄、前綴與外層引號', () => {
    expect(cleanDescription('```\n描述：「收錄粵語翻唱」\n```')).toBe('收錄粵語翻唱');
    expect(cleanDescription('  收錄插畫  ')).toBe('收錄插畫');
  });

  it('截到長度上限', () => {
    expect(cleanDescription('字'.repeat(DESCRIBE_MAX_CHARS + 50))).toHaveLength(DESCRIBE_MAX_CHARS);
  });

  it('拿掉句尾的句號（一句話不需要，還會佔掉字數）', () => {
    expect(cleanDescription('插畫與繪師作品。')).toBe('插畫與繪師作品');
  });
});

describe('DESCRIBE_SYSTEM_PROMPT', () => {
  it('要求一句話、寫明長度上限、不要重述標題、只輸出那句話', () => {
    expect(DESCRIBE_SYSTEM_PROMPT).toContain('一句話');
    expect(DESCRIBE_SYSTEM_PROMPT).toContain(`${DESCRIBE_MAX_CHARS} 字以內`);
    expect(DESCRIBE_SYSTEM_PROMPT).toContain('不要把影片標題重述一遍');
    expect(DESCRIBE_SYSTEM_PROMPT).toContain('只輸出這句話本身');
  });

  it('字數不夠時捨棄細節而不是寫排除條件', () => {
    expect(DESCRIBE_SYSTEM_PROMPT).toContain('不要寫排除條件');
  });

  it('禁止把樣本裡的少數派寫成整個夾子的主軸', () => {
    expect(DESCRIBE_SYSTEM_PROMPT).toContain('不要寫「以…為主」「以…為中心」');
    expect(DESCRIBE_SYSTEM_PROMPT).toContain('沿用它的範圍');
  });
});
