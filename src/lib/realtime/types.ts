/**
 * 即時通訊轉接層（Realtime Adapter）
 *
 * 設計目的：把「遊戲邏輯」與「實際使用的即時服務」解耦。
 *   - SupabaseAdapter：正式上線用（雲端，學生手機可連）
 *   - MockAdapter   ：本機開發用（同一個瀏覽器的多個分頁即可互通）
 *
 * 只要符合這個介面，之後要換成 WebSocket / Firebase 都不必動遊戲邏輯。
 */

import type { Role } from '@/types'

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'closed'

/** 同房成員的狀態（Presence） */
export interface PresenceMember {
  /** 此連線的唯一 id */
  clientId: string
  /** 是否為老師端（遊戲主機） */
  isTeacher: boolean
  seatNo?: string
  name?: string
  role?: Role
  /** 是否「不在分頁」（切到別的 APP / 分頁） */
  away?: boolean
  /** 加入時間 */
  joinedAt: number
  /** 最後一次心跳時間 */
  lastSeen: number
}

/** 加入房間時要宣告的自己的資訊 */
export type PresenceMeta = Omit<PresenceMember, 'clientId' | 'lastSeen'>

export interface BroadcastSender {
  clientId: string
  member?: PresenceMember
}

export type Unsubscribe = () => void

export interface RealtimeAdapter {
  /** 本連線的唯一 id */
  readonly selfId: string
  /** 目前使用的實作 */
  readonly mode: 'mock' | 'supabase'
  /** 目前連線狀態 */
  readonly status: ConnectionStatus
  /** 目前房間內所有成員（含自己） */
  readonly members: PresenceMember[]

  /** 連上某個房間頻道 */
  connect(roomCode: string, meta: PresenceMeta): Promise<void>
  /** 更新自己的 Presence 資訊（例如切到別的分頁） */
  updateMeta(patch: Partial<PresenceMeta>): void
  /** 離線並清除監聽 */
  disconnect(): void

  /** 廣播一個事件給房間內所有人 */
  broadcast<T>(event: string, payload: T): void

  /** 監聽某個事件（回傳取消監聽函式） */
  on<T>(event: string, handler: (payload: T, sender: BroadcastSender) => void): Unsubscribe

  /** 監聽成員名單變化 */
  onMembers(handler: (members: PresenceMember[]) => void): Unsubscribe

  /** 監聽連線狀態變化 */
  onStatus(handler: (status: ConnectionStatus) => void): Unsubscribe
}

/* ------------------------------------------------------------------ */
/* 房間事件名稱（供遊戲邏輯使用）                                       */
/* ------------------------------------------------------------------ */

export const ROOM_EVENTS = {
  /** 學生 → 老師：請求加入 */
  JOIN: 'join',
  /** 老師 → 個別學生：加入結果（同意 / 拒絕） */
  JOIN_RESULT: 'join-result',
  /** 老師 → 全班：大廳狀態 */
  LOBBY_STATE: 'lobby-state',
  /** 學生 → 老師：答題結果 */
  ANSWER: 'answer',
  /** 老師 → 全班：共享狀態（王血/團隊血/能量/倒數） */
  STATE: 'state',
  /** 老師 → 個別學生：下一題 */
  QUESTION: 'question',
  /** 老師 → 全班：戰鬥事件（傷害數字、技能、魔王攻擊、勝敗） */
  BATTLE_EVENT: 'battle-event',
  /** 老師 → 全班：結算結果（排行榜與獎項） */
  RESULTS: 'results',
  /** 老師 → 個別學生：踢除 */
  KICK: 'kick',
  /** 老師 → 全班：遊戲階段切換（大廳/戰鬥/結算） */
  PHASE: 'phase',
} as const
