import type { Estimate } from '@/core/estimate';
import { useMessages } from '../hooks/useI18n';

/**
 * 依目前設定列出「會打哪些請求、各幾次、換到什麼」。
 * compact 是設定頁側欄用的窄版：省掉「對象」欄與每列的補充說明（那些在「這次會做什麼」視窗裡看得到），
 * 不然 470px 的欄位會把「取得什麼」擠成一行三個字。
 */
export function RequestTable({ estimate, compact = false }: { estimate: Estimate; compact?: boolean }) {
  const m = useMessages();
  return (
    <table className="grid">
      <thead>
        <tr>
          <th style={{ width: compact ? 168 : 210 }}>{m.requestTable.request}</th>
          <th>{m.requestTable.whatItGets}</th>
          <th style={{ width: compact ? 56 : 70, textAlign: 'right' }}>{m.requestTable.count}</th>
          {!compact && <th style={{ width: 86 }}>{m.requestTable.against}</th>}
        </tr>
      </thead>
      <tbody>
        {estimate.rows.map((row) => (
          <tr key={row.key} className={row.count === 0 ? 'off' : undefined}>
            <td className="vtop">
              {/* 端點名只准在斜線後面斷行，不能把 `created/list` 從字中間切開 */}
              <span className="endpoint">
                {row.endpoint.split('/').map((part, i, all) => (
                  <span key={all.slice(0, i + 1).join('/')}>
                    {part}
                    {i < all.length - 1 && (
                      <>
                        /<wbr />
                      </>
                    )}
                  </span>
                ))}
              </span>
            </td>
            <td className="vtop">
              {row.purpose}
              {!compact && row.note && <div className="desc">{row.note}</div>}
            </td>
            <td className="n vtop">
              {row.approx && row.count > 0 ? '≤ ' : ''}
              {row.count}
            </td>
            {!compact && <td className="vtop dim">{m.estimate.kindLabel[row.kind]}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
