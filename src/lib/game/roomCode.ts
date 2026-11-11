/**
 * 房間代碼工具
 */

/** 已排除容易混淆的字元（0/O、1/I/L） */
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateRoomCode(length = 4): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += CHARS[Math.floor(Math.random() * CHARS.length)]
  }
  return out
}

/** 正規化使用者輸入的房間代碼 */
export function normalizeRoomCode(input: string): string {
  return input.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
}
