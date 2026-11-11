/**
 * localStorage 存取工具（存放老師的設定、名單、學生身分等小型資料）
 *
 * 註：題庫與圖片走 IndexedDB（見 idb.ts），因為 localStorage 容量太小。
 */

const PREFIX = 'pixel-heroes:'

export const STORAGE_KEYS = {
  /** 題庫索引（題目本體與圖片放 IndexedDB） */
  questionBank: 'question-bank',
  /** 班級名單 */
  roster: 'roster',
  /** 上次使用的遊戲設定 */
  lastSettings: 'last-settings',
  /** 學生身分（斷線重連用） */
  studentIdentity: 'student-identity',
  /** 歷史遊戲紀錄 */
  history: 'history',
} as const

function fullKey(key: string): string {
  return PREFIX + key
}

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(fullKey(key))
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    console.warn(`[localStore] 讀取 ${key} 失敗，使用預設值`, err)
    return fallback
  }
}

export function saveJson<T>(key: string, value: T): void {
  try {
    localStorage.setItem(fullKey(key), JSON.stringify(value))
  } catch (err) {
    console.warn(`[localStore] 寫入 ${key} 失敗`, err)
  }
}

export function removeKey(key: string): void {
  try {
    localStorage.removeItem(fullKey(key))
  } catch {
    /* ignore */
  }
}
