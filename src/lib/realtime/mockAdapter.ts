/**
 * MockAdapter — 本機開發用的即時通訊實作
 *
 * 使用 BroadcastChannel，讓「同一個瀏覽器的多個分頁」可以互相通訊。
 * 開發時可以：一個分頁開老師端、其他分頁開學生端，就能測試整個遊戲。
 *
 * 正式上線請改用 SupabaseAdapter（見 supabaseAdapter.ts）。
 */

import type {
  BroadcastSender,
  ConnectionStatus,
  PresenceMember,
  PresenceMeta,
  RealtimeAdapter,
  Unsubscribe,
} from './types'

type InternalMessage =
  | { kind: 'event'; event: string; payload: unknown; senderId: string; ts: number }
  | { kind: 'presence'; meta: PresenceMeta; senderId: string; ts: number }
  | { kind: 'presence-query'; senderId: string; ts: number }
  | { kind: 'leave'; senderId: string; ts: number }

const HEARTBEAT_MS = 3000
const PRUNE_MS = 12000

export class MockAdapter implements RealtimeAdapter {
  readonly selfId: string = crypto.randomUUID()
  readonly mode = 'mock' as const

  private channel: BroadcastChannel | null = null
  private meta: PresenceMeta | null = null

  private _status: ConnectionStatus = 'idle'
  private _members = new Map<string, PresenceMember>()

  private eventHandlers = new Map<string, Set<(payload: unknown, sender: BroadcastSender) => void>>()
  private memberHandlers = new Set<(members: PresenceMember[]) => void>()
  private statusHandlers = new Set<(status: ConnectionStatus) => void>()

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private pruneTimer: ReturnType<typeof setInterval> | null = null

  get status(): ConnectionStatus {
    return this._status
  }

  get members(): PresenceMember[] {
    return [...this._members.values()].sort((a, b) => a.joinedAt - b.joinedAt)
  }

  async connect(roomCode: string, meta: PresenceMeta): Promise<void> {
    // 只重置連線資源，保留已註冊的監聽器
    this.teardown()
    this.meta = meta
    this.setStatus('connecting')

    this.channel = new BroadcastChannel(`pixel-heroes-room:${roomCode}`)
    this.channel.onmessage = (ev: MessageEvent<InternalMessage>) => this.handleMessage(ev.data)

    // 宣告自己存在，並詢問房間內有誰
    this.announce()
    this.post({ kind: 'presence-query', senderId: this.selfId, ts: Date.now() })

    this.heartbeatTimer = setInterval(() => this.announce(), HEARTBEAT_MS)
    this.pruneTimer = setInterval(() => this.prune(), HEARTBEAT_MS)

    // 把「自己」也放進成員清單
    this.upsertSelf()
    this.setStatus('connected')
  }

  disconnect(): void {
    this.teardown()
    if (this._status !== 'idle') this.setStatus('closed')
    this.eventHandlers.clear()
    this.memberHandlers.clear()
    this.statusHandlers.clear()
  }

  /** 關閉連線資源與成員狀態，但保留事件監聽器 */
  private teardown(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.pruneTimer) clearInterval(this.pruneTimer)
    this.heartbeatTimer = null
    this.pruneTimer = null

    if (this.channel) {
      this.post({ kind: 'leave', senderId: this.selfId, ts: Date.now() })
      this.channel.onmessage = null
      this.channel.close()
      this.channel = null
    }

    this._members.clear()
    this.emitMembers()
    this.meta = null
  }

  updateMeta(patch: Partial<PresenceMeta>): void {
    if (!this.meta) return
    this.meta = { ...this.meta, ...patch }
    this.upsertSelf()
    this.announce()
  }

  broadcast<T>(event: string, payload: T): void {
    if (event.startsWith('__')) {
      throw new Error(`事件名稱不可使用保留前綴 "__"：${event}`)
    }
    this.post({ kind: 'event', event, payload, senderId: this.selfId, ts: Date.now() })
  }

  on<T>(event: string, handler: (payload: T, sender: BroadcastSender) => void): Unsubscribe {
    const set = this.eventHandlers.get(event) ?? new Set()
    set.add(handler as (payload: unknown, sender: BroadcastSender) => void)
    this.eventHandlers.set(event, set)
    return () => {
      set.delete(handler as (payload: unknown, sender: BroadcastSender) => void)
    }
  }

  onMembers(handler: (members: PresenceMember[]) => void): Unsubscribe {
    this.memberHandlers.add(handler)
    handler(this.members)
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

  private post(msg: InternalMessage): void {
    this.channel?.postMessage(msg)
  }

  private announce(): void {
    if (!this.meta) return
    this.post({ kind: 'presence', meta: this.meta, senderId: this.selfId, ts: Date.now() })
  }

  private upsertSelf(): void {
    if (!this.meta) return
    this._members.set(this.selfId, {
      ...this.meta,
      clientId: this.selfId,
      lastSeen: Date.now(),
    })
    this.emitMembers()
  }

  private handleMessage(msg: InternalMessage): void {
    if (!msg || msg.senderId === this.selfId) return

    switch (msg.kind) {
      case 'presence': {
        const existed = this._members.has(msg.senderId)
        this._members.set(msg.senderId, {
          ...msg.meta,
          clientId: msg.senderId,
          lastSeen: Date.now(),
        })
        if (!existed) {
          // 新成員加入，主動回報自己讓對方也看到
          this.announce()
        }
        this.emitMembers()
        break
      }
      case 'presence-query': {
        this.announce()
        break
      }
      case 'leave': {
        this._members.delete(msg.senderId)
        this.emitMembers()
        break
      }
      case 'event': {
        const handlers = this.eventHandlers.get(msg.event)
        if (!handlers) return
        const sender: BroadcastSender = {
          clientId: msg.senderId,
          member: this._members.get(msg.senderId),
        }
        handlers.forEach((h) => h(msg.payload, sender))
        break
      }
    }
  }

  private prune(): void {
    const now = Date.now()
    let changed = false
    for (const [id, member] of this._members) {
      if (id === this.selfId) continue
      if (now - member.lastSeen > PRUNE_MS) {
        this._members.delete(id)
        changed = true
      }
    }
    if (changed) this.emitMembers()
    // 更新自己的 lastSeen
    const self = this._members.get(this.selfId)
    if (self) this._members.set(this.selfId, { ...self, lastSeen: now })
  }

  private emitMembers(): void {
    const snapshot = this.members
    this.memberHandlers.forEach((h) => h(snapshot))
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status
    this.statusHandlers.forEach((h) => h(status))
  }
}
