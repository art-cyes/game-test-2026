/**
 * 遊戲大廳的領域邏輯
 *
 * 核心設計：老師端依「Presence 名單」推導出誰成功加入，
 * 判斷結果是「確定性的」——即使老師端重新整理，也能重建正確名單。
 */

import type { PresenceMember } from '@/lib/realtime'
import type { BossDifficulty, Role } from '@/types'

export type GamePhase = 'lobby' | 'battle' | 'result'

export interface PlayerSlot {
  clientId: string
  seatNo: string
  name: string
  role: Role
  /** 是否在線 */
  online: boolean
  /** 在線但切到別的分頁／APP */
  away: boolean
  joinedAt: number
}

export interface LobbyState {
  roomCode: string
  className: string
  bossName: string
  bossDifficulty: BossDifficulty
  maxPlayers: number
  allowLateJoin: boolean
  phase: GamePhase
  /** 已成功加入的人數 */
  playerCount: number
  capacityReached: boolean
}

export interface JoinRequest {
  seatNo: string
  name: string
  role: Role
}

/** 帶目標對象的訊息（只有 target 這個連線要處理） */
export interface Targeted<T> {
  target: string
  data: T
}

export type JoinResponse =
  | { ok: true }
  | { ok: false; reason: string }

export interface ValidationResult {
  /** 成功加入的玩家（僅在線者） */
  players: PlayerSlot[]
  /** 被拒絕的連線 */
  rejected: { clientId: string; reason: string }[]
}

/**
 * 由 Presence 名單推導出「誰成功加入、誰被拒絕」。
 *
 * 規則：
 *   1. 同一個座號只取最早加入的那條連線，其餘視為重複
 *   2. 人數不得超過上限
 *   3. 遊戲已開始且不允許中途加入時，只接受「開始前就在場的座號」
 */
export function resolveLobby(opts: {
  members: PresenceMember[]
  maxPlayers: number
  phase: GamePhase
  allowLateJoin: boolean
  /** 遊戲開始時鎖定的座號（避免已加入的學生因重整而被踢） */
  lockedSeats: Set<string>
}): ValidationResult {
  const { members, maxPlayers, phase, allowLateJoin, lockedSeats } = opts

  type Item = { member: PresenceMember; seatNo: string }
  const groups = new Map<string, Item[]>()

  for (const m of members) {
    if (m.isTeacher) continue
    const raw = (m.seatNo ?? '').trim()
    if (!raw) continue
    const num = Number(raw)
    if (!Number.isFinite(num)) continue
    const seatNo = String(num)
    const arr = groups.get(seatNo) ?? []
    arr.push({ member: m, seatNo })
    groups.set(seatNo, arr)
  }

  const accepted: PlayerSlot[] = []
  const rejected: { clientId: string; reason: string }[] = []

  for (const [seatNo, group] of groups) {
    group.sort(
      (a, b) => a.member.joinedAt - b.member.joinedAt || a.member.clientId.localeCompare(b.member.clientId),
    )
    const owner = group[0]

    for (const extra of group.slice(1)) {
      rejected.push({
        clientId: extra.member.clientId,
        reason: '這個座號已經有人使用了，請確認你的座號是否正確。',
      })
    }

    if (phase !== 'lobby' && !allowLateJoin && !lockedSeats.has(seatNo)) {
      rejected.push({ clientId: owner.member.clientId, reason: '遊戲已經開始，無法中途加入。' })
      continue
    }

    accepted.push({
      clientId: owner.member.clientId,
      seatNo,
      name: owner.member.name || `座號 ${seatNo}`,
      role: owner.member.role ?? 'warrior',
      online: true,
      away: Boolean(owner.member.away),
      joinedAt: owner.member.joinedAt,
    })
  }

  accepted.sort((a, b) => a.joinedAt - b.joinedAt || Number(a.seatNo) - Number(b.seatNo))

  if (accepted.length > maxPlayers) {
    for (const p of accepted.slice(maxPlayers)) {
      rejected.push({
        clientId: p.clientId,
        reason: `人數已滿（上限 ${maxPlayers} 人），請通知老師。`,
      })
    }
    accepted.length = maxPlayers
  }

  return { players: accepted, rejected }
}
