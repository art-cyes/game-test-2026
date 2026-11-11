import { useEffect, useMemo, useRef, useState } from 'react'
import {
  createRealtimeAdapter,
  type ConnectionStatus,
  type PresenceMember,
  type PresenceMeta,
  type RealtimeAdapter,
} from '@/lib/realtime'

interface Options {
  /** 房間代碼；null 表示尚未加入 */
  roomCode: string | null
  /** 自己的資訊；null 表示尚未準備好 */
  meta: PresenceMeta | null
}

interface Result {
  adapter: RealtimeAdapter
  status: ConnectionStatus
  members: PresenceMember[]
  /** 其他成員（不含自己） */
  others: PresenceMember[]
  selfId: string
}

/**
 * 管理即時房間的連線生命週期。
 * 一個 hook 實例對應一條連線。
 */
export function useRealtimeRoom({ roomCode, meta }: Options): Result {
  const adapterRef = useRef<RealtimeAdapter | null>(null)
  if (!adapterRef.current) {
    adapterRef.current = createRealtimeAdapter()
  }
  const adapter = adapterRef.current

  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [members, setMembers] = useState<PresenceMember[]>([])

  // meta 以穩定字串作為依賴，避免每次 render 重新連線
  const metaKey = useMemo(() => (meta ? JSON.stringify(meta) : null), [meta])

  useEffect(() => {
    if (!roomCode || !metaKey) return
    const offStatus = adapter.onStatus(setStatus)
    const offMembers = adapter.onMembers(setMembers)

    void adapter.connect(roomCode, JSON.parse(metaKey) as PresenceMeta)

    return () => {
      offStatus()
      offMembers()
      adapter.disconnect()
    }
  }, [adapter, roomCode, metaKey])

  const others = useMemo(
    () => members.filter((m) => m.clientId !== adapter.selfId),
    [members, adapter.selfId],
  )

  return { adapter, status, members, others, selfId: adapter.selfId }
}
