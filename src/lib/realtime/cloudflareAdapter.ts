/**
 * CloudflareAdapter — 走自己部署的 Cloudflare Worker + Durable Object。
 *
 * 前端與 Worker 同一個網域，所以 WebSocket 直接用 `/ws`，不需要環境變數。
 * 若在本機開發時想連 `wrangler dev`，可用 VITE_REALTIME_URL 指定（見 env.ts）。
 *
 * 行為與 SupabaseAdapter / MockAdapter 完全一致：
 *   - members 含自己
 *   - broadcast 不會 echo 回自己
 *   - onMembers / onStatus 訂閱時會立刻回呼一次目前狀態
 */

import { makeClientId } from './ids'
import type {
  BroadcastSender,
  ConnectionStatus,
  PresenceMember,
  PresenceMeta,
  RealtimeAdapter,
  Unsubscribe,
} from './types'

interface ServerMessage {
  t: 'presence' | 'msg'
  members?: PresenceMember[]
  from?: string
  event?: string
  payload?: unknown
}

export class CloudflareAdapter implements RealtimeAdapter {
  readonly selfId: string = makeClientId()
  readonly mode = 'cloudflare' as const

  private ws: WebSocket | null = null
  private meta: PresenceMeta | null = null

  private _status: ConnectionStatus = 'idle'
  private _members: PresenceMember[] = []

  private eventHandlers = new Map<string, Set<(payload: unknown, sender: BroadcastSender) => void>>()
  private memberHandlers = new Set<(members: PresenceMember[]) => void>()
  private statusHandlers = new Set<(status: ConnectionStatus) => void>()

  /** baseUrl 留空 = 用目前網址（同一個 Worker） */
  private readonly baseUrl: string

  constructor(baseUrl = '') {
    this.baseUrl = baseUrl
  }

  get status(): ConnectionStatus {
    return this._status
  }

  get members(): PresenceMember[] {
    return this._members
  }

  async connect(roomCode: string, meta: PresenceMeta): Promise<void> {
    this.teardown()
    this.meta = meta
    this.setStatus('connecting')

    const base =
      this.baseUrl.trim() ||
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`
    const url = `${base.replace(/\/+$/, '')}/ws?room=${encodeURIComponent(roomCode)}&id=${this.selfId}`

    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      this.setStatus('error')
      return
    }
    this.ws = ws

    ws.onopen = () => {
      this.setStatus('connected')
      if (this.meta) this.send({ t: 'join', meta: this.meta })
    }
    ws.onmessage = (ev: MessageEvent) => this.handle(ev.data)
    ws.onerror = () => this.setStatus('error')
    ws.onclose = () => {
      if (this._status !== 'idle') this.setStatus('closed')
    }
  }

  disconnect(): void {
    this.teardown()
    if (this._status !== 'idle') this.setStatus('closed')
    this.eventHandlers.clear()
    this.memberHandlers.clear()
    this.statusHandlers.clear()
  }

  /** 關閉連線與名單，但保留事件監聽器 */
  private teardown(): void {
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onerror = null
      this.ws.onclose = null
      try {
        this.ws.close()
      } catch {
        /* 已經關了 */
      }
      this.ws = null
    }
    this._members = []
    this.emitMembers()
    this.meta = null
  }

  updateMeta(patch: Partial<PresenceMeta>): void {
    if (!this.meta) return
    this.meta = { ...this.meta, ...patch }
    this.send({ t: 'join', meta: this.meta })
  }

  broadcast<T>(event: string, payload: T): void {
    if (event.startsWith('__')) {
      throw new Error(`事件名稱不可使用保留前綴 "__"：${event}`)
    }
    this.send({ t: 'msg', event, payload })
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

  private send(obj: unknown): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj))
    }
  }

  private handle(data: unknown): void {
    if (typeof data !== 'string') return

    let msg: ServerMessage
    try {
      msg = JSON.parse(data) as ServerMessage
    } catch {
      return
    }

    if (msg.t === 'presence') {
      this._members = msg.members ?? []
      this.emitMembers()
      return
    }

    if (msg.t === 'msg' && typeof msg.event === 'string') {
      const handlers = this.eventHandlers.get(msg.event)
      if (!handlers) return
      const sender: BroadcastSender = {
        clientId: msg.from ?? 'unknown',
        member: this._members.find((m) => m.clientId === msg.from),
      }
      handlers.forEach((h) => h(msg.payload, sender))
    }
  }

  private emitMembers(): void {
    const snapshot = this._members
    this.memberHandlers.forEach((h) => h(snapshot))
  }

  private setStatus(status: ConnectionStatus): void {
    this._status = status
    this.statusHandlers.forEach((h) => h(status))
  }
}
