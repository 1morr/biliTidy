import { FAV_PAGE_SIZE } from '@/bilibili/fav';
import { t } from '@/i18n';
import type { Settings } from '@/shared/types';
import { planOf } from './plan';
import { DETAIL_TTL_DAYS } from './settings';

export interface FlowStep {
  key: string;
  title: string;
  /** 這一步實際會做什麼；會隨設定改寫 */
  detail: string;
  /** false = 目前設定不會走到這一步 */
  active: boolean;
}

/**
 * 依目前設定描述一次整理實際會走的路徑。與 estimate.ts 是同一組規則的兩種呈現：
 * 那邊回答「打幾次請求」，這邊回答「照什麼順序做、哪些步驟被跳過」。
 */
export function planFlow(settings: Settings): FlowStep[] {
  const { features } = settings;
  const { visionActive, withDetail, withSubtitle, withCover, batchSize } = planOf(settings);
  const m = t().flow.steps;

  return [
    {
      key: 'list',
      title: m.list.title,
      detail: m.list.detail(FAV_PAGE_SIZE),
      active: true,
    },
    {
      key: 'invalid',
      title: m.invalid.title,
      detail: m.invalid.detail,
      active: true,
    },
    {
      key: 'detail',
      title: m.detail.title,
      detail: withDetail ? m.detail.detailOn(DETAIL_TTL_DAYS) : m.detail.detailOff,
      active: withDetail,
    },
    {
      key: 'subtitle',
      title: m.subtitle.title,
      detail: !features.fetchSubtitle ? m.subtitle.off : !withDetail ? m.subtitle.needsDetail : m.subtitle.on,
      active: withSubtitle,
    },
    {
      key: 'cover',
      title: m.cover.title,
      detail: !visionActive ? m.cover.visionInactive : withCover ? m.cover.on : m.cover.off,
      active: withCover,
    },
    {
      key: 'classify',
      title: m.classify.title,
      detail: withCover ? m.classify.withCover(batchSize) : m.classify.textOnly(batchSize),
      active: true,
    },
    {
      key: 'review',
      title: m.review.title,
      detail: m.review.detail,
      active: true,
    },
    {
      key: 'move',
      title: m.move.title,
      detail: m.move.detail(settings.rate.moveBatchSize),
      active: true,
    },
  ];
}
