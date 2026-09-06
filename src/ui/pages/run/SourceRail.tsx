import { useState } from 'react';
import { FolderCover } from '../../components/FolderCover';
import { IconRefresh, IconSearch } from '../../components/icons';
import { useMessages } from '../../hooks/useI18n';
import { useAppStore } from '../../store';

/**
 * 來源收藏夾常駐在左軌：39 個夾子用一列一個的清單，比 39 張大卡片省掉一整屏，
 * 而且選完之後它還在原地——換來源不必先捲回頁首。
 */
export function SourceRail({ mid, disabled }: { mid: number; disabled: boolean }) {
  const m = useMessages();
  const folders = useAppStore((s) => s.folders);
  const foldersLoading = useAppStore((s) => s.foldersLoading);
  const foldersError = useAppStore((s) => s.foldersError);
  const loadFolders = useAppStore((s) => s.loadFolders);
  const sourceId = useAppStore((s) => s.sourceId);
  const setSource = useAppStore((s) => s.setSource);

  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  // 選中的那個一律顯示，免得篩選之後看不到自己選了什麼
  const shown = folders.filter((f) => f.id === sourceId || f.title.toLowerCase().includes(q));
  const total = folders.reduce((n, f) => n + f.mediaCount, 0);

  return (
    <aside className="rail">
      <div className="rail-sec" style={{ borderBottom: 0, paddingBottom: 10 }}>
        <span className="lbl">{m.sourceRail.sourceFolder}</span>
        <label className="search">
          <IconSearch />
          <input
            type="text"
            aria-label={m.sourceRail.searchFolders}
            placeholder={folders.length > 0 ? m.sourceRail.searchNFolders(folders.length) : m.sourceRail.searchFolders}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>

      {foldersError && (
        <div className="rail-sec" style={{ borderBottom: 0, paddingTop: 0 }}>
          <div className="banner error" style={{ marginBottom: 0 }}>
            <span>{foldersError}</span>
            <button type="button" className="link spacer" onClick={() => void loadFolders(mid)}>
              {m.sourceRail.retry}
            </button>
          </div>
        </div>
      )}

      <div className="src-list">
        {shown.map((f) => (
          <button
            key={f.id}
            type="button"
            className={f.id === sourceId ? 'src-row on' : 'src-row'}
            disabled={disabled}
            aria-pressed={f.id === sourceId}
            onClick={() => void setSource(f.id)}
          >
            <FolderCover folder={f} size="sm" />
            <span className="src-name">{f.title}</span>
            {f.id === sourceId ? (
              <span className="pin">{m.sourceRail.source}</span>
            ) : (
              <span className="src-n">{f.mediaCount}</span>
            )}
          </button>
        ))}
        {shown.length === 0 && <div className="rail-sec dim">{m.sourceRail.noMatchingFolders}</div>}
      </div>

      <div className="rail-foot">
        <IconRefresh />
        <span className="num">{m.sourceRail.folderCount(folders.length, total)}</span>
        <button type="button" className="link spacer" disabled={foldersLoading || disabled} onClick={() => void loadFolders(mid)}>
          {foldersLoading ? m.common.loading : m.sourceRail.reload}
        </button>
      </div>
    </aside>
  );
}
