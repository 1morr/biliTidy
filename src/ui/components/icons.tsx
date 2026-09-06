/**
 * 介面用的圖示，一律畫出來（16px 網格、1.5 描邊），不用 emoji 或符號字元：
 * 系統字型少一個字就會變成豆腐方塊，而且大小、粗細、對齊都跟旁邊的文字對不上。
 */

type Props = { size?: number; className?: string };

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function svg(size: number, className: string | undefined, children: React.ReactNode, filled = false) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      {...(filled ? { fill: 'currentColor' } : stroke)}
    >
      {children}
    </svg>
  );
}

/**
 * 品牌記號：一顆打勾的圓——「先審核、再動手」是兩個功能共同的核心，
 * 與工具列圖示（`scripts/gen-icons.mjs`：粉色圓底＋白色勾）同一個符號。
 */
export function IconBrand({ size = 17, className }: Props) {
  return svg(
    size,
    className,
    <>
      <circle cx="8" cy="8" r="6.4" />
      <path d="M5 8.3 7.2 10.5 11.2 5.9" strokeWidth={1.8} />
    </>,
  );
}

export function IconSparkle({ size = 14, className }: Props) {
  return svg(
    size,
    className,
    <>
      <path d="M6.6 1.8 7.9 5.3 11.4 6.6 7.9 7.9 6.6 11.4 5.3 7.9 1.8 6.6 5.3 5.3z" />
      <path d="M11.9 9.5l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6z" />
    </>,
    true,
  );
}

export function IconArrowRight({ size = 15, className }: Props) {
  return svg(size, className, <path d="M2.5 8h11m-4-4 4 4-4 4" />);
}

export function IconArrowUp({ size = 11, className }: Props) {
  return svg(size, className, <path d="M8 13V3m-4 4 4-4 4 4" />);
}

export function IconArrowDown({ size = 12, className }: Props) {
  return svg(size, className, <path d="M8 3v10m-4-4 4 4 4-4" />);
}

export function IconCheck({ size = 12, className }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.4 6.3 11.7 13 5" />
    </svg>
  );
}

export function IconSearch({ size = 13, className }: Props) {
  return svg(
    size,
    className,
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.4 10.4 14 14" />
    </>,
  );
}

export function IconRefresh({ size = 13, className }: Props) {
  return svg(
    size,
    className,
    <>
      <path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.97" />
      <path d="M13.7 2.4v2.6h-2.6" />
    </>,
  );
}

export function IconUndo({ size = 14, className }: Props) {
  return svg(
    size,
    className,
    <>
      <path d="M2.5 6.5h7a4 4 0 0 1 0 8H6" />
      <path d="M5.5 3.5l-3 3 3 3" />
    </>,
  );
}

export function IconUserMinus({ size = 14, className }: Props) {
  return svg(
    size,
    className,
    <>
      <circle cx="6.3" cy="5" r="2.5" />
      <path d="M1.9 13.4c0-2.6 2-4.3 4.4-4.3s4.4 1.7 4.4 4.3" />
      <path d="M11.2 9.6h3.4" />
    </>,
  );
}

export function IconLock({ size = 12, className }: Props) {
  return svg(
    size,
    className,
    <>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.2" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </>,
  );
}

export function IconPlay({ size = 14, className }: Props) {
  return svg(size, className, <path d="M5 3.2v9.6l7.5-4.8z" fill="currentColor" stroke="none" />);
}

export function IconDownload({ size = 13, className }: Props) {
  return svg(
    size,
    className,
    <>
      <path d="M8 2.5v8m-3.5-3.5L8 10.5 11.5 7" />
      <path d="M2.5 12.5h11" />
    </>,
  );
}

export function IconCopy({ size = 13, className }: Props) {
  return svg(
    size,
    className,
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
      <path d="M10.5 5.5V3.7a1.2 1.2 0 0 0-1.2-1.2H3.7a1.2 1.2 0 0 0-1.2 1.2v5.6a1.2 1.2 0 0 0 1.2 1.2h1.8" />
    </>,
  );
}

export function IconClose({ size = 13, className }: Props) {
  return svg(size, className, <path d="M4 4l8 8M12 4l-8 8" />);
}

export function IconInfo({ size = 14, className }: Props) {
  return svg(
    size,
    className,
    <>
      <circle cx="8" cy="8" r="6.4" />
      <path d="M8 7.2v4M8 4.9v.9" />
    </>,
  );
}

export function IconPlus({ size = 15, className }: Props) {
  return svg(size, className, <path d="M8 3.5v9M3.5 8h9" />);
}

export function IconDoc({ size = 14, className }: Props) {
  return svg(
    size,
    className,
    <>
      <path d="M2.5 3.5h11v9h-11z" />
      <path d="M4.6 6.4h4.4M4.6 9h6.8" />
    </>,
  );
}

/** 設定的段落導覽（20px 網格） */
export function IconPlug({ size = 18, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={className} {...stroke}>
      <path d="M8.2 11.8a3.6 3.6 0 0 0 5.1 0l2.6-2.6a3.6 3.6 0 0 0-5.1-5.1l-1 1" />
      <path d="M11.8 8.2a3.6 3.6 0 0 0-5.1 0l-2.6 2.6a3.6 3.6 0 0 0 5.1 5.1l1-1" />
    </svg>
  );
}

export function IconEye({ size = 18, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={className} {...stroke}>
      <path d="M1.8 10S4.9 4.6 10 4.6 18.2 10 18.2 10 15.1 15.4 10 15.4 1.8 10 1.8 10Z" />
      <circle cx="10" cy="10" r="2.4" />
    </svg>
  );
}

export function IconRules({ size = 18, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={className} {...stroke}>
      <path d="M3.5 4.5h13M3.5 9h13M3.5 13.5h8" />
    </svg>
  );
}

export function IconGauge({ size = 18, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={className} {...stroke}>
      <circle cx="10" cy="11" r="6.4" />
      <path d="M10 11V7.4M10 2.6v1.4" />
    </svg>
  );
}

export function IconData({ size = 18, className }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" className={className} {...stroke}>
      <ellipse cx="10" cy="5" rx="6.4" ry="2.4" />
      <path d="M3.6 5v10c0 1.3 2.9 2.4 6.4 2.4s6.4-1.1 6.4-2.4V5" />
      <path d="M3.6 10c0 1.3 2.9 2.4 6.4 2.4s6.4-1.1 6.4-2.4" />
    </svg>
  );
}
