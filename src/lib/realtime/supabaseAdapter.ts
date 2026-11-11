/**
 * SupabaseAdapter — 正式環境用的即時通訊實作（Supabase Realtime）
 *
 * Supabase 在此專案中「只當訊息匯流排」，不使用資料庫：
 *   - Broadcast：老師端 ↔ 學生端 的事件傳遞
 *   - Presence ：在線 / 離線狀態
 *
 * 需要環境變數：VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY
 */

import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js'
import type {
  BroadcastSender,
  ConnectionStatus,
  PresenceMember,
  PresenceMeta,
  RealtimeAdapter,
  Unsubscribe,
} from './types'

/** 廣播封包外層，用來夾帶發送者資訊 */
interface Envelope<T> {
  s: string // senderId
  d: T // data
}

export class SupabaseAdapter implements RealtimeAdapter {
  readonly selfId: string = crypto.randomUUID()
  readonly mode = 'supabase' as const

  private client: SupabaseClient
  private channel: RealtimeChannel | null = null
  private myMeta: PresenceMeta | null = null

  private _status: ConnectionStatus = 'idle'
  private _members: PresenceMember[] = []

  private eventHandlers = new Map<string, Set<(payload: unknown, sender: BroadcastSender) => void>>()
  private attachedEvents = new Set<string>()
  private memberHandlers = new Set<(members: PresenceMember[]) => void>()
  private statusHandlers = new Set<(status: ConnectionStatus) => void>()

  constructor(url: string, anonKey: string) {
    this.client = createClient(url, anonKey, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 20 } },
    })
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get members(): PresenceMember[] {
    return this._members
  }

  async connect(roomCode: string, meta: PresenceMeta): Promise<void> {
    // 只重置頻道，保留已註冊的監聽器
    this.teardownChannel()
    this.myMeta = meta
    this.setStatus('connecting')

    const channel = this.client.channel(`pixel-heroes-room:${roomCode}`, {
      config: {
        presence: { key: this.selfId },
        broadcast: { self: false },
      },
    })
    this.channel = channel

    // 既有的事件監聽全部掛上
    for (const event of this.eventHandlers.keys()) {
      this.attachEvent(event)
    }

    // Presence 同步
    channel.on('presence', { event: 'sync' }, () => {
      this.syncMembers()
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.setStatus('connected')
        void channel.track(meta)
        this.syncMembers()
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setStatus('error')
      } else if (status === 'CLOSED') {
        this.setStatus('closed')
      }
    })
  }

  disconnect(): void {
    this.teardownChannel()
    if (this._status !== 'idle') this.setStatus('closed')
    this.eventHandlers.clear()
    this.memberHandlers.clear()
    this.statusHandlers.clear()
  }

  /** 關閉頻道，但保留事件監聽器 */
  private teardownChannel(): void {
    if (this.channel) {
      void this.client.removeChannel(this.channel)
      this.channel = null
    }
    this._members = []
    this.attachedEvents.clear()
    this.myMeta = null
    this.emitMembers()
  }

  updateMeta(patch: Partial<PresenceMeta>): void {
    if (!this.myMeta) return
    this.myMeta = { ...this.myMeta, ...patch }
    void this.channel?.track(this.myMeta)
  }

  broadcast<T>(event: string, payload: T): void {
    if (event.startsWith('__')) {
      throw new Error(`事件名稱不可使用保留前綴 "__"：${event}`)
    }
    if (!this.channel) return
    const envelope: Envelope<T> = { s: this.selfId, d: payload }
    void this.channel.send({ type: 'broadcast', event, payload: envelope })
  }

  on<T>(event: string, handler: (payload: T, sender: BroadcastSender) => void): Unsubscribe {
    const set = this.eventHandlers.get(event) ?? new Set()
    set.add(handler as (payload: unknown, sender: BroadcastSender) => void)
    this.eventHandlers.set(event, set)
    this.attachEvent(event)
    return () => {
      set.delete(handler as (payload: unknown, sender: BroadcastSender) => void)
    }
  }

  onMembers(handler: (members: PresenceMember[]) => void): Unsubscribe {
    this.memberHandlers.add(handler)
    handler(this._members)
    return () => {
      this.memberHandlers.delete(handler)
    }
  }

  onStatus(handler: (status: ConnectionStatus) => void): Unsubscribe {
    this.statusHandlers.add(handler)
    handler(this._status)
    return () => {
      this.statusHandlers.delete(handler)
    }
  }

  /* ------------------------------- 內部 ------------------------------- */

  private attachEvent(event: string): void {
    if (!this.channel || this.attachedEvents.has(event)) return
    this.attachedEvents.add(event)
    this.channel.on('broadcast', { event }, (msg) => {
      const envelope = msg.payload as Envelope<unknown> | undefined
      const senderId = envelope?.s ?? 'unknown'
      const data = envelope?.d
      const sender: BroadcastSender = {
        clientId: senderId,
        member: this._members.find((m) => m.clientId === senderId),
      }
      this.eventHandlers.get(event)?.forEach((h) => h(data, sender))
    })
  }

  private syncMembers(): void {
    if (!this.channel) return
    const state = this.channel.presenceState<PresenceMeta>()
    const now = Date.now()
    const members: PresenceMember[] = []
    for (const [clientId, presences] of Object.entries(state)) {
      for (const p of presences) {
        const meta = p as unknown as PresenceMeta
        members.push({ ...meta, clientId, lastSeen: now })
      }
    }
    this._members = members.sort((a, b) => a.joinedAt - b.joinedAt)
    this.emitMembers()
  }

  private emitMembers(): void {
    this.memberHandlers.forEach((h) => h(this._members))
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status
    this.statusHandlers.forEach((h) => h(status))
  }
}
