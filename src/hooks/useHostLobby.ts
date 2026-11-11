import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BOSS_PRESETS } from '@/config/gameDefaults'
import { loadKnownPlayers, saveKnownPlayers } from '@/lib/game/gameStore'
import {
  resolveLobby,
  type GamePhase,
  type JoinResponse,
  type LobbyState,
  type PlayerSlot,
  type Targeted,
} from '@/lib/game/lobby'
import { ROOM_EVENTS, type PresenceMeta } from '@/lib/realtime'
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom'
import type { GameSettings } from '@/types'

interface Options {
  roomCode: string | null
  settings: GameSettings | null
}

/**
 * 老師端（遊戲主機）的大廳狀態管理。
 *
 * 老師端是唯一權威：由 Presence 名單推導出誰成功加入、誰被拒絕，
 * 並負責發送加入結果、大廳狀態與踢人指令。
 */
export function useHostLobby({ roomCode, settings }: Options) {
  const meta = useMemo<PresenceMeta | null>(
    () => (roomCode ? { isTeacher: true, name: '老師', joinedAt: Date.now() } : null),
    [roomCode],
  )

  const { adapter, status, members, selfId } = useRealtimeRoom({ roomCode, meta })

  const [phase, setPhase] = useState<GamePhase>('lobby')
  const [known, setKnown] = useState<PlayerSlot[]>(() =>
    roomCode ? loadKnownPlayers(roomCode) : [],
  )
  const [kickedIds, setKickedIds] = useState<Set<string>>(() => new Set())

  /** 遊戲開始時鎖定的座號（避免已加入的學生重整後被踢） */
  const lockedSeatsRef = useRef<Set<string>>(new Set())
  /** 已經通知過結果的連線，避免重複發送 */
  const acknowledgedRef = useRef<Set<string>>(new Set())

  // 換房間就重置
  useEffect(() => {
    setKnown(roomCode ? loadKnownPlayers(roomCode) : [])
    setPhase('lobby')
    lockedSeatsRef.current = new Set()
    acknowledgedRef.current = new Set()
    setKickedIds(new Set())
  }, [roomCode])

  const visibleMembers = useMemo(
    () => members.filter((m) => !kickedIds.has(m.clientId)),
    [members, kickedIds],
  )

  const maxPlayers = settings?.maxPlayers ?? 40
  const allowLateJoin = settings?.allowLateJoin ?? true

  const { players: onlinePlayers, rejected } = useMemo(
    () =>
      resolveLobby({
        members: visibleMembers,
        maxPlayers,
        phase,
        allowLateJoin,
        lockedSeats: lockedSeatsRef.current,
      }),
    [visibleMembers, maxPlayers, phase, allowLateJoin],
  )

  /** 合併「曾經看過的玩家」，讓離線學生仍留在名單上 */
  const players = useMemo<PlayerSlot[]>(() => {
    const bySeat = new Map<string, PlayerSlot>()
    for (const p of known) bySeat.set(p.seatNo, { ...p, online: false, away: false })
    for (const p of onlinePlayers) bySeat.set(p.seatNo, p)
    return [...bySeat.values()].sort((a, b) => Number(a.seatNo) - Number(b.seatNo))
  }, [known, onlinePlayers])

  // 記錄看過的玩家
  useEffect(() => {
    if (!roomCode || onlinePlayers.length === 0) return
    setKnown((prev) => {
      const map = new Map(prev.map((p) => [p.seatNo, p]))
      let changed = false
      for (const p of onlinePlayers) {
        const old = map.get(p.seatNo)
        if (!old || old.name !== p.name || old.role !== p.role || old.clientId !== p.clientId) {
          map.set(p.seatNo, p)
          changed = true
        }
      }
      if (!changed) return prev
      const next = [...map.values()]
      saveKnownPlayers(roomCode, next)
      return next
    })
  }, [onlinePlayers, roomCode])

  // 清理已經離開的踢除紀錄
  useEffect(() => {
    setKickedIds((prev) => {
      if (prev.size === 0) return prev
      const present = new Set(members.map((m) => m.clientId))
      let changed = false
      const next = new Set<string>()
      for (const id of prev) {
        if (present.has(id)) next.add(id)
        else changed = true
      }
      return changed ? next : prev
    })
  }, [members])

  // 發送加入結果
  useEffect(() => {
    if (!roomCode || status !== 'connected') return
    const ack = acknowledgedRef.current
    for (const p of onlinePlayers) {
      const key = `ok:${p.clientId}`
      if (ack.has(key)) continue
      ack.add(key)
      const msg: Targeted<JoinResponse> = { target: p.clientId, data: { ok: true } }
      adapter.broadcast(ROOM_EVENTS.JOIN_RESULT, msg)
    }
    for (const r of rejected) {
      const key = `no:${r.clientId}`
      if (ack.has(key)) continue
      ack.add(key)
      const msg: Targeted<JoinResponse> = { target: r.clientId, data: { ok: false, reason: r.reason } }
      adapter.broadcast(ROOM_EVENTS.JOIN_RESULT, msg)
    }
  }, [adapter, status, roomCode, onlinePlayers, rejected])

  const onlineRef = useRef(onlinePlayers)
  onlineRef.current = onlinePlayers
  const rejectedRef = useRef(rejected)
  rejectedRef.current = rejected

  // 學生主動請求加入時立即回覆（不必等 Presence 同步）
  useEffect(() => {
    if (!roomCode || status !== 'connected') return
    const off = adapter.on(ROOM_EVENTS.JOIN, (_payload, sender) => {
      const accepted = onlineRef.current.find((p) => p.clientId === sender.clientId)
      if (accepted) {
        const msg: Targeted<JoinResponse> = { target: sender.clientId, data: { ok: true } }
        adapter.broadcast(ROOM_EVENTS.JOIN_RESULT, msg)
        return
      }
      const denied = rejectedRef.current.find((r) => r.clientId === sender.clientId)
      if (denied) {
        const msg: Targeted<JoinResponse> = {
          target: sender.clientId,
          data: { ok: false, reason: denied.reason },
        }
        adapter.broadcast(ROOM_EVENTS.JOIN_RESULT, msg)
      }
    })
    return off
  }, [adapter, roomCode, status])

  const lobbyState = useMemo<LobbyState | null>(() => {
    if (!roomCode || !settings) return null
    const boss = BOSS_PRESETS[settings.bossDifficulty]
    return {
      roomCode,
      className: settings.className || '未命名班級',
      bossName: boss.name,
      bossDifficulty: settings.bossDifficulty,
      maxPlayers: settings.maxPlayers,
      allowLateJoin: settings.allowLateJoin,
      phase,
      playerCount: onlinePlayers.length,
      capacityReached: onlinePlayers.length >= settings.maxPlayers,
    }
  }, [roomCode, settings, phase, onlinePlayers.length])

  const lobbyStateRef = useRef<LobbyState | null>(null)
  lobbyStateRef.current = lobbyState

  // 大廳狀態一變就立即廣播
  useEffect(() => {
    if (status !== 'connected' || !lobbyState) return
    adapter.broadcast(ROOM_EVENTS.LOBBY_STATE, lobbyState)
  }, [adapter, status, lobbyState])

  // 定期廣播大廳狀態（讓中途加入的學生也能同步）
  useEffect(() => {
    if (status !== 'connected') return
    const send = () => {
      if (lobbyStateRef.current) adapter.broadcast(ROOM_EVENTS.LOBBY_STATE, lobbyStateRef.current)
    }
    send()
    const id = setInterval(send, 3000)
    return () => clearInterval(id)
  }, [adapter, status])

  const kick = useCallback(
    (clientId: string) => {
      const msg: Targeted<string> = { target: clientId, data: '老師將你移出了遊戲。' }
      adapter.broadcast(ROOM_EVENTS.KICK, msg)
      setKickedIds((prev) => new Set(prev).add(clientId))
    },
    [adapter],
  )

  const startGame = useCallback(() => {
    lockedSeatsRef.current = new Set(onlinePlayers.map((p) => p.seatNo))
    setPhase('battle')
    adapter.broadcast(ROOM_EVENTS.PHASE, { phase: 'battle' })
  }, [adapter, onlinePlayers])

  const backToLobby = useCallback(() => {
    lockedSeatsRef.current = new Set()
    setPhase('lobby')
    adapter.broadcast(ROOM_EVENTS.PHASE, { phase: 'lobby' })
  }, [adapter])

  /** 由外部（例如戰鬥結束）切換階段 */
  const setPhaseExternal = useCallback(
    (next: GamePhase) => {
      if (next === 'lobby') lockedSeatsRef.current = new Set()
      setPhase(next)
      adapter.broadcast(ROOM_EVENTS.PHASE, { phase: next })
    },
    [adapter],
  )

  const onlineCount = onlinePlayers.length
  const awayCount = onlinePlayers.filter((p) => p.away).length

  return {
    adapter,
    status,
    selfId,
    players,
    onlinePlayers,
    onlineCount,
    awayCount,
    rejected,
    phase,
    lobbyState,
    kick,
    startGame,
    backToLobby,
    setPhaseExternal,
  }
}
