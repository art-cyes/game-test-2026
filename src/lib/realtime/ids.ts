/**
 * 產生連線用的唯一 id。
 * crypto.randomUUID() 只在安全來源（https / localhost）可用，
 * 這裡加上退路，避免在區網 http 開啟時整個壞掉。
 */
export function makeClientId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID()
    }
  } catch {
    /* 不支援就用下面的退路 */
  }
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
