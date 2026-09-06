import { create } from 'zustand';
import { listCreatedFolders } from '@/bilibili/fav';
import { applyRateSettings } from '@/core/scheduler';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from '@/core/settings';
import {
  DEFAULT_RUN_SCOPE,
  loadDescriptions,
  loadRunScope,
  loadSourceId,
  loadTargetIds,
  saveDescriptions,
  saveRunScope,
  saveSourceId,
  saveTargetIds,
} from '@/core/folderStore';
import type { FolderMeta, RunScope, Settings } from '@/shared/types';

/**
 * 描述是逐字打出來的，每個字都寫一次 storage 等於把整份描述 map 讀出來改再寫回去；
 * 兩次按鍵夾在同一輪讀改寫裡時，後寫的那次會拿舊快照覆蓋掉前一次（掉字）。
 * UI 讀的是記憶體狀態，所以延後幾百毫秒才落地沒有差別，離開頁面前補寫一次即可。
 */
const DESCRIPTION_SAVE_DELAY_MS = 400;
let pendingDescriptions: Record<string, string> = {};
let descriptionTimer: ReturnType<typeof setTimeout> | null = null;
let flushHooked = false;

/** 取走還沒落地的編輯並停掉計時器；呼叫端負責把它寫出去（不可以再開第二條寫入路徑） */
function takePendingDescriptions(): Record<string, string> {
  if (descriptionTimer !== null) {
    clearTimeout(descriptionTimer);
    descriptionTimer = null;
  }
  const patch = pendingDescriptions;
  pendingDescriptions = {};
  return patch;
}

function flushDescriptions(): void {
  const patch = takePendingDescriptions();
  if (Object.keys(patch).length > 0) void saveDescriptions(patch).catch(() => undefined);
}

function queueDescriptionSave(mediaId: number, text: string): void {
  pendingDescriptions[String(mediaId)] = text;
  if (descriptionTimer !== null) clearTimeout(descriptionTimer);
  descriptionTimer = setTimeout(flushDescriptions, DESCRIPTION_SAVE_DELAY_MS);
  if (!flushHooked && typeof window !== 'undefined') {
    flushHooked = true;
    window.addEventListener('pagehide', flushDescriptions);
  }
}

interface AppState {
  hydrated: boolean;
  settings: Settings;
  folders: FolderMeta[];
  foldersLoading: boolean;
  foldersError: string | null;
  descriptions: Record<string, string>;
  targetIds: number[];
  sourceId: number | null;
  runScope: RunScope;

  hydrate: () => Promise<void>;
  updateSettings: (patch: (s: Settings) => Settings) => Promise<void>;
  loadFolders: (mid: number, signal?: AbortSignal) => Promise<void>;
  setDescription: (mediaId: number, text: string) => Promise<void>;
  /** 一次寫多筆本機描述（採用 AI 草稿用）；空字串代表刪掉那一筆 */
  setDescriptions: (patch: Record<string, string>) => Promise<void>;
  toggleTarget: (mediaId: number, on: boolean) => Promise<void>;
  setTargets: (ids: number[]) => Promise<void>;
  setSource: (mediaId: number | null) => Promise<void>;
  setRunScope: (scope: RunScope) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  hydrated: false,
  settings: DEFAULT_SETTINGS,
  folders: [],
  foldersLoading: false,
  foldersError: null,
  descriptions: {},
  targetIds: [],
  sourceId: null,
  runScope: DEFAULT_RUN_SCOPE,

  async hydrate() {
    const [settings, descriptions, targetIds, runScope, sourceId] = await Promise.all([
      loadSettings(),
      loadDescriptions(),
      loadTargetIds(),
      loadRunScope(),
      loadSourceId(),
    ]);
    applyRateSettings(settings.rate);
    // 來源夾不會同時是目標夾（下面 setSource 也維持這個規則）
    set({
      settings,
      descriptions,
      targetIds: targetIds.filter((id) => id !== sourceId),
      runScope,
      sourceId,
      hydrated: true,
    });
  },

  async updateSettings(patch) {
    const next = await saveSettings(patch(get().settings));
    applyRateSettings(next.rate);
    set({ settings: next });
  },

  async loadFolders(mid, signal) {
    set({ foldersLoading: true, foldersError: null });
    try {
      const folders = await listCreatedFolders(mid, signal);
      const state = get();
      // 來源沿用上次選的（存在 storage），沒有或已不存在才落回第一個（通常是默认收藏夹）
      const ids = new Set(folders.map((f) => f.id));
      const sourceId = state.sourceId !== null && ids.has(state.sourceId) ? state.sourceId : (folders[0]?.id ?? null);
      const targetIds = state.targetIds.filter((id) => ids.has(id) && id !== sourceId);
      set({ folders, foldersLoading: false, sourceId, targetIds });
      // 收藏夾被刪掉、或來源落回第一個時，把修正後的選擇寫回去，免得下次開又冒出來
      if (sourceId !== state.sourceId) await saveSourceId(sourceId);
      if (targetIds.length !== state.targetIds.length) await saveTargetIds(targetIds);
    } catch (e) {
      set({ foldersLoading: false, foldersError: e instanceof Error ? e.message : String(e) });
    }
  },

  async setDescription(mediaId, text) {
    set((s) => ({ descriptions: { ...s.descriptions, [String(mediaId)]: text } }));
    queueDescriptionSave(mediaId, text);
  },

  async setDescriptions(patch) {
    // 還沒落地的逐字輸入併進同一次寫入：分成兩次寫會變成兩條並行的讀改寫，又繞回掉字
    const merged = { ...takePendingDescriptions(), ...patch };
    set({ descriptions: await saveDescriptions(merged) });
  },

  async toggleTarget(mediaId, on) {
    const current = get().targetIds;
    const next = on ? Array.from(new Set([...current, mediaId])) : current.filter((id) => id !== mediaId);
    set({ targetIds: next });
    await saveTargetIds(next);
  },

  async setTargets(ids) {
    set({ targetIds: ids });
    await saveTargetIds(ids);
  },

  async setSource(mediaId) {
    const next = get().targetIds.filter((id) => id !== mediaId);
    set({ sourceId: mediaId, targetIds: next });
    await Promise.all([saveSourceId(mediaId), saveTargetIds(next)]);
  },

  async setRunScope(scope) {
    set({ runScope: scope });
    await saveRunScope(scope);
  },
}));
