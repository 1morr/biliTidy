import { useEffect, useState } from 'react';

/** 設定頁與其他分頁共用的表單零件。排版刻意一致，混在同一頁時看起來是同一種控制項。 */

/** 測試按鈕的四種狀態；confirm = 回來了但要使用者確認描述對得上那張圖才算通過 */
export type TestState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'ok'; message: string }
  | { status: 'fail'; message: string }
  | { status: 'confirm'; message: string };

/** 一組互斥選項；`badge` 用來標出實測最好的那個，不必在說明裡再寫一次 */
export interface ModeOption<T extends string> {
  value: T;
  title: string;
  note: string;
  badge?: string;
}

/**
 * 數字輸入。輸入中允許空字串（不然刪到最後一個字就會變成 0），
 * 但只有合法的數字才會寫回設定，離開欄位時夾回範圍內——
 * 曾經因為把 0 寫進設定而讓整段 ai 退回預設，連 API Key 都被清掉。
 */
export function NumberField({
  id,
  label,
  value,
  min,
  max,
  step,
  hint,
  placeholder,
  disabled = false,
  onChange,
}: {
  id: string;
  label: string;
  value: number | undefined;
  min: number;
  max: number;
  step?: number;
  hint?: string;
  placeholder?: string;
  disabled?: boolean;
  onChange: (value: number | undefined) => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    setText(value === undefined ? '' : String(value));
  }, [value]);

  const commit = (raw: string) => {
    setText(raw);
    if (raw.trim() === '') {
      onChange(undefined);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
  };

  const clamp = () => {
    if (text.trim() === '') return;
    const n = Number(text);
    if (!Number.isFinite(n)) {
      setText(value === undefined ? '' : String(value));
      return;
    }
    const fixed = Math.min(max, Math.max(min, n));
    setText(String(fixed));
    onChange(fixed);
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        disabled={disabled}
        value={text}
        onChange={(e) => commit(e.target.value)}
        onBlur={clamp}
      />
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** 單一開關。排版刻意跟 ModeField 的選項列一致，兩者混在同一頁時看起來是同一種控制項 */
export function ToggleField({
  label,
  checked,
  note,
  badge,
  disabled = false,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  note: string;
  badge?: string;
  disabled?: boolean;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="field">
      <label className="check">
        <input type="checkbox" disabled={disabled} checked={checked} onChange={(e) => onChange(e.target.checked)} />
        {label}
        {badge && <span className="tag ok">{badge}</span>}
        <span className="hint inline">{note}</span>
      </label>
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

/** 一組互斥選項；每個選項自帶一行成本說明，所以用 radio 而不是下拉 */
export function ModeField<T extends string>({
  label,
  name,
  options,
  value,
  disabled = false,
  hint,
  onChange,
}: {
  label: string;
  name: string;
  options: ModeOption<T>[];
  value: T;
  disabled?: boolean;
  hint?: string;
  onChange: (value: T) => void;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {options.map((o) => (
        <label className="check" key={o.value}>
          <input type="radio" name={name} disabled={disabled} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.title}
          {o.badge && <span className="tag ok">{o.badge}</span>}
          <span className="hint inline">{o.note}</span>
        </label>
      ))}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function TestNote({ state }: { state: TestState }) {
  if (state.status === 'ok') return <span className="status-done">{state.message}</span>;
  if (state.status === 'fail') return <span className="status-failed">{state.message}</span>;
  return null;
}
