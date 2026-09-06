import { storage } from 'wxt/utils/storage';
import type { RunScope } from '@/shared/types';

/** 收藏夾本機描述：{ [mediaId]: description }，餵給 AI 當分類依據 */
const descriptionsItem = storage.defineItem<Record<string, string>>('local:folderDescriptions', {
  fallback: {},
});

/** 上次勾選的目標收藏夾 id，重開頁面時還原 */
const targetsItem = storage.defineItem<number[]>('local:targetFolderIds', { fallback: [] });

/** 上次選的來源收藏夾；與目標、範圍一樣要記住，不然每次重開都跳回第一個夾 */
const sourceItem = storage.defineItem<number | null>('local:sourceFolderId', { fallback: null });

export const DEFAULT_RUN_SCOPE: RunScope = { mode: 'all', count: 100 };

/** 上次選的整理範圍 */
const runScopeItem = storage.defineItem<RunScope>('local:runScope', { fallback: DEFAULT_RUN_SCOPE });

/**
 * 送給 AI 的收藏夾描述：本機描述優先，沒寫就退回 B 站那邊的收藏夾簡介。
 * 簡介本來就是使用者自己寫的收錄意圖，空著不用只是讓分類少一份線索；
 * 整理流程與影片頁的「智慧收藏」都經過這一支，兩邊看到的描述才會一致。
 */
export function effectiveDescription(folder: { id: number; intro?: string }, descriptions: Record<string, string>): string {
  return (descriptions[String(folder.id)] ?? '').trim() || (folder.intro ?? '').trim();
}

export async function loadDescriptions(): Promise<Record<string, string>> {
  return descriptionsItem.getValue();
}

/** 批次寫入（逐字輸入的合併寫入、採用草稿都走這支）；空字串代表刪除該筆 */
export async function saveDescriptions(patch: Record<string, string>): Promise<Record<string, string>> {
  const next = { ...(await descriptionsItem.getValue()) };
  for (const [id, text] of Object.entries(patch)) {
    if (text.trim()) next[id] = text.trim();
    else delete next[id];
  }
  await descriptionsItem.setValue(next);
  return next;
}

export async function loadTargetIds(): Promise<number[]> {
  return targetsItem.getValue();
}

export async function saveTargetIds(ids: number[]): Promise<void> {
  await targetsItem.setValue(ids);
}

export async function loadSourceId(): Promise<number | null> {
  const id = await sourceItem.getValue();
  return typeof id === 'number' && Number.isFinite(id) ? id : null;
}

export async function saveSourceId(id: number | null): Promise<void> {
  await sourceItem.setValue(id);
}

export async function loadRunScope(): Promise<RunScope> {
  const scope = await runScopeItem.getValue();
  return {
    mode: scope?.mode === 'latest' ? 'latest' : 'all',
    count: Number.isFinite(scope?.count) && scope.count > 0 ? Math.floor(scope.count) : DEFAULT_RUN_SCOPE.count,
  };
}

export async function saveRunScope(scope: RunScope): Promise<void> {
  await runScopeItem.setValue(scope);
}
