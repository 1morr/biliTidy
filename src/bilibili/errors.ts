import { t } from '@/i18n';
import { AppError } from '@/shared/result';

/** 來源：bilibili-API-collect docs/misc/errcode.md、各收藏夾端點頁面與 docs/user/relation.md */
export const BILI_CODE = {
  NOT_LOGIN: -101,
  BANNED: -102,
  CSRF: -111,
  RISK: -352,
  BAD_REQUEST: -400,
  FORBIDDEN: -403,
  NOT_FOUND: -404,
  IP_BLOCKED: -412,
  LIMIT: -632,
  TOO_FREQUENT: -799,
  FAV_NOT_FOUND: 11010,
  FAV_ALREADY: 11201,
  FAV_CANCELLED: 11202,
  FAV_FULL: 11203,
  /** relation/modify：不能對自己操作 */
  REL_SELF: 22001,
  /** 對方的隱私設定不允許關注 */
  REL_PRIVACY: 22002,
  /** 對方在黑名單裡 */
  REL_BLACKLISTED: 22003,
  /** 關注數已達上限 */
  REL_FOLLOW_LIMIT: 22009,
  /** 帳號已註銷 */
  REL_ACCOUNT_CANCELLED: 22013,
  /** 已經關注 */
  REL_ALREADY_FOLLOWING: 22014,
  /** 分組不存在 */
  REL_TAG_NOT_FOUND: 22104,
  /** 未關注（改分組時） */
  REL_NOT_FOLLOWING: 22105,
  /** 對方把關注清單設為隱私 */
  REL_LIST_PRIVATE: 22115,
  USER_NOT_FOUND: 40061,
} as const;

export function classifyBiliError(code: number, message: string): AppError {
  const m = t().errors.bilibili;
  switch (code) {
    case BILI_CODE.NOT_LOGIN:
      return new AppError('auth', m.notSignedIn, { code });
    case BILI_CODE.BANNED:
      return new AppError('forbidden', m.banned, { code, retryable: false });
    case BILI_CODE.CSRF:
      return new AppError('csrf', m.csrfFailed, { code });
    case BILI_CODE.RISK:
    case BILI_CODE.IP_BLOCKED:
    case BILI_CODE.TOO_FREQUENT:
      return new AppError('riskControl', m.riskControl(code, message), { code });
    case BILI_CODE.FORBIDDEN:
    case BILI_CODE.REL_PRIVACY:
    case BILI_CODE.REL_LIST_PRIVATE:
      return new AppError('forbidden', m.forbidden(message), { code, retryable: false });
    case BILI_CODE.NOT_FOUND:
    case BILI_CODE.FAV_NOT_FOUND:
    case BILI_CODE.USER_NOT_FOUND:
    case BILI_CODE.REL_ACCOUNT_CANCELLED:
      return new AppError('notFound', m.notFound(message), { code, retryable: false });
    case BILI_CODE.LIMIT:
      return new AppError('limit', m.limitExceeded, { code, retryable: false });
    case BILI_CODE.REL_FOLLOW_LIMIT:
      return new AppError('limit', m.followLimit, { code, retryable: false });
    default:
      return new AppError('api', m.apiError(code, message), { code, retryable: false });
  }
}
