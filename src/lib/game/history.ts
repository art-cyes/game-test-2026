/**
 * 遊戲歷史紀錄（存在老師的瀏覽器裡）
 */

import { loadJson, saveJson } from '@/lib/storage/localStore'
import type { GameRecord } from '@/types'

const KEY = 'history'
/** 最多保留幾場 */
const MAX_RECORDS = 50

export function loadHistory(): GameRecord[] {
  const list = loadJson<GameRecord[]>(KEY, [])
  if (!Array.isArray(list)) return []
  return list.filter((r) => r && typeof r.id === 'string')
}

function persist(list: GameRecord[]): void {
  saveJson(KEY, list.slice(0, MAX_RECORDS))
}

export function saveGameRecord(record: GameRecord): void {
  const list = loadHistory().filter((r) => r.id !== record.id)
  persist([record, ...list])
}

export function removeGameRecord(id: string): void {
  persist(loadHistory().filter((r) => r.id !== id))
}

export function clearHistory(): void {
  persist([])
}
