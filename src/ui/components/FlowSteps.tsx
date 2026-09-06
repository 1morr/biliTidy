import { planFlow } from '@/core/flow';
import type { Settings } from '@/shared/types';
import { useMessages } from '../hooks/useI18n';

/** 依目前設定畫出這次會走的流程；被跳過的步驟仍列出但標灰，方便對照設定的影響 */
export function FlowSteps({ settings }: { settings: Settings }) {
  const m = useMessages();
  const steps = planFlow(settings);
  return (
    <ol className="flow">
      {steps.map((s, i) => (
        <li key={s.key} className={s.active ? 'fstep-lg' : 'fstep-lg off'}>
          <span className="fnum">{i + 1}</span>
          <span className="fstep-body">
            <span className="fstep-title">
              {s.title}
              {!s.active && <span className="tag">{m.flow.skip}</span>}
            </span>
            <span className="desc">{s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
