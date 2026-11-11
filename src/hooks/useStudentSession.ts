import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GamePhase, JoinResponse, LobbyState, Targeted } from '@/lib/game/lobby'
import { ROOM_EVENTS, type PresenceMeta } from '@/lib/realtime'
import { useRealtimeRoom } from '@/hooks/useRealtimeRoom'
import type { Role } from '@/types'
import { usePageVisibility } from './usePageVisibility'

export type StudentJoinState =
  | 'idle'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'kicked'
  | 'timeout'

export interface StudentIdentity {
  seatNo: string
  name: string
  role: Role
}

interface Options {
  roomCode: string | null
  identity: StudentIdentity | null
}

const MAX_JOIN_ATTEMPTS = 8
const JOIN_RETRY_MS = 1500

/**
 * 學生端：連上房間、請求加入、接收老師端的回覆與大廳狀態。
 */
export function useStudentSession({ roomCode, identity }: Options) {
  const meta = useMemo<PresenceMeta | null>(
    () =>
      identity
        ? {
            isTeacher: false,
            seatNo: identity.seatNo,
            name: identity.name,
            role: identity.role,
            away: false,
            joinedAt: Date.now(),
          }
        : null,
    [identity],
  )

  const { adapter, status, selfId } = useRealtimeRoom({ roomCode, meta })

  const [joinState, setJoinState] = useState<StudentJoinState>('idle')
  const [reason, setReason] = useState('')
  const [lobby, setLobby] = useState<LobbyState | null>(null)
  const [phase, setPhase] = useState<GamePhase>('lobby')

  // 切換房間 / 身分時重置
  useEffect(() => {
    if (!identity) {
      setJoinState('idle')
    } else {
      setJoinState('pending')
    }
    setReason('')
    setLobby(null)
    setPhase('lobby')
  }, [roomCode, identity])

  // 接收老師端的訊息
  useEffect(() => {
    if (!roomCode || !identity) return

    const offResult = adapter.on<Targeted<JoinResponse>>(ROOM_EVENTS.JOIN_RESULT, (payload) => {
      if (!payload || payload.target !== selfId) return
      if (payload.data.ok) {
        setJoinState('accepted')
        setReason('')
      } else {
        setJoinState('rejected')
        setReason(payload.data.reason)
      }
    })

    const offKick = adapter.on<Targeted<string>>(ROOM_EVENTS.KICK, (payload) => {
      if (!payload || payload.target !== selfId) return
      setJoinState('kicked')
      setReason(payload.data || '老師將你移出了遊戲。')
    })

    const offLobby = adapter.on<LobbyState>(ROOM_EVENTS.LOBBY_STATE, (payload) => {
      if (!payload) return
      setLobby(payload)
      // 老師端每 3 秒廣播一次，順便讓階段保持一致
      if (payload.phase) setPhase(payload.phase)
    })

    const offPhase = adapter.on<{ phase: GamePhase }>(ROOM_EVENTS.PHASE, (payload) => {
      if (payload?.phase) setPhase(payload.phase)
    })

    return () => {
      offResult()
      offKick()
      offLobby()
      offPhase()
    }
  }, [adapter, roomCode, identity, selfId])

  // 送出加入請求（沒收到回覆會自動重試）
  useEffect(() => {
    if (!roomCode || !identity || status !== 'connected' || joinState !== 'pending') return

    let attempts = 0
    const send = () => {
      adapter.broadcast(ROOM_EVENTS.JOIN, {
        seatNo: identity.seatNo,
        name: identity.name,
        role: identity.role,
      })
      attempts += 1
    }

    send()
    const id = setInterval(() => {
      if (attempts >= MAX_JOIN_ATTEMPTS) {
        clearInterval(id)
        setJoinState((prev) => (prev === 'pending' ? 'timeout' : prev))
        return
      }
      send()
    }, JOIN_RETRY_MS)

    return () => clearInterval(id)
  }, [adapter, roomCode, identity, status, joinState])

  // 回報「不在分頁」
  usePageVisibility((hidden) => {
    if (status === 'connected') adapter.updateMeta({ away: hidden })
  })

  const retry = useCallback(() => {
    setReason('')
    setJoinState(identity ? 'pending' : 'idle')
  }, [identity])

  return { adapter, status, selfId, joinState, reason, lobby, phase, retry }
}
