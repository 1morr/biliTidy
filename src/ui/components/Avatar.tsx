import { faceUrl } from '../format';

/** 圓形頭像；沒有網址就留一個同尺寸的底色圓，版面不會跳 */
export function Avatar({ face, size = 'md' }: { face: string; size?: 'sm' | 'md' | 'lg' }) {
  const px = size === 'lg' ? 80 : 64;
  const src = faceUrl(face, px);
  const className = size === 'sm' ? 'avatar' : `avatar ${size}`;
  if (!src) return <span className={className} aria-hidden="true" />;
  return <img className={className} src={src} alt="" loading="lazy" referrerPolicy="no-referrer" />;
}
