import { useState } from 'react';
import { coverUrl } from '@/bilibili/cover';
import type { FolderMeta } from '@/shared/types';

/** 收藏夾縮圖；沒有封面或載入失敗時退回首字方塊 */
export function FolderCover({ folder, size = 'md' }: { folder: FolderMeta; size?: 'md' | 'sm' | 'lg' }) {
  const [broken, setBroken] = useState(false);
  const cls = size === 'md' ? 'folder-cover' : `folder-cover ${size}`;
  if (!folder.cover || broken) {
    return (
      <div className={`${cls} placeholder`} aria-hidden="true">
        {folder.title.slice(0, 1)}
      </div>
    );
  }
  return (
    <img
      className={cls}
      src={coverUrl(folder.cover, size === 'sm' ? '48w_48h_1c' : '96w_96h_1c')}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
