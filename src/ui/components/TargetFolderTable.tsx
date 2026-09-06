import { effectiveDescription } from '@/core/folderStore';
import { useMessages } from '../hooks/useI18n';
import { useAppStore } from '../store';
import { FolderCover } from './FolderCover';

/**
 * 目標收藏夾勾選。描述只讀——編輯與 AI 生成都在「收藏夾」分頁，
 * 這裡照樣顯示是為了讓人在按「開始分類」前看得到 AI 會拿到什麼。
 *
 * 篩選字串由整理頁持有：輸入框長在頂部工具列上，表格只負責畫列。
 */
export function TargetFolderTable({
  query,
  disabled = false,
  onEditDescriptions,
}: {
  query: string;
  disabled?: boolean;
  onEditDescriptions: () => void;
}) {
  const m = useMessages();
  const folders = useAppStore((s) => s.folders);
  const sourceId = useAppStore((s) => s.sourceId);
  const targetIds = useAppStore((s) => s.targetIds);
  const descriptions = useAppStore((s) => s.descriptions);
  const toggleTarget = useAppStore((s) => s.toggleTarget);

  const all = folders.filter((f) => f.id !== sourceId);
  if (all.length === 0) return <p className="c-pad dim">{m.targetFolderTable.noTargetCandidates}</p>;
  // 已勾選的一律顯示，避免篩選後看不到自己選了什麼
  const q = query.trim().toLowerCase();
  const candidates = all.filter((f) => targetIds.includes(f.id) || f.title.toLowerCase().includes(q));
  // 本機沒寫、B 站也沒簡介的目標＝AI 真的只剩夾名可看，這種才值得提醒
  const missing = all.filter((f) => targetIds.includes(f.id) && !effectiveDescription(f, descriptions)).length;

  return (
    <>
      {missing > 0 && (
        <div className="c-pad" style={{ paddingBottom: 0 }}>
          <div className="banner warn">
            <span className="dot" style={{ background: 'var(--warn)' }} />
            <span>{m.targetFolderTable.missingDescriptionsBanner(missing)}</span>
            <button type="button" className="link spacer" onClick={onEditDescriptions}>
              {m.targetFolderTable.fillThemIn}
            </button>
          </div>
        </div>
      )}
      <table className="grid">
        <thead>
          <tr>
            <th style={{ width: 44 }} />
            <th style={{ width: 230 }}>{m.targetFolderTable.folder}</th>
            <th>{m.targetFolderTable.descriptionHeader}</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((f) => {
            const desc = effectiveDescription(f, descriptions);
            const fromBili = desc !== '' && (descriptions[String(f.id)] ?? '').trim() === '';
            const picked = targetIds.includes(f.id);
            return (
              <tr key={f.id} className={picked ? 'picked' : undefined}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={m.targetFolderTable.selectAsTarget(f.title)}
                    checked={picked}
                    disabled={disabled}
                    onChange={(e) => void toggleTarget(f.id, e.target.checked)}
                  />
                </td>
                <td>
                  <span className="fold">
                    <FolderCover folder={f} />
                    <span className="folder-info">
                      <span className="folder-title">{f.title}</span>
                      <span className="folder-sub">
                        {m.run.videosUnit(f.mediaCount)}
                        {f.isPrivate && <span className="tag">{m.targetFolderTable.private}</span>}
                        {f.isDefault && <span className="tag">{m.targetFolderTable.default}</span>}
                      </span>
                    </span>
                  </span>
                </td>
                <td className={desc ? 'muted' : 'dim'}>
                  {desc || m.targetFolderTable.noDescriptionAiOnlyName}
                  {fromBili && (
                    <span className="tag pink" style={{ marginLeft: 8 }}>
                      {m.targetFolderTable.fromBilibiliDescription}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
          {candidates.length === 0 && (
            <tr>
              <td colSpan={3} className="dim">
                {m.targetFolderTable.noMatchingFolders}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
