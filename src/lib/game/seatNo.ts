/**
 * 座號工具
 */

/** 正規化座號（去掉前導零、空白與非數字字元） */
export function normalizeSeatNo(input: string): string {
  const digits = input.trim().replace(/[^\d]/g, '')
  if (!digits) return ''
  return String(Number(digits))
}

/** 座號排序用 */
export function compareSeatNo(a: string, b: string): number {
  return Number(a) - Number(b)
}
