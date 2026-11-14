/// <reference types="@cloudflare/workers-types" />

/**
 * Room — 每個房間代碼對應一個 Durable Object。
 *
 * 同時扮演兩個角色（原本由 Supabase Realtime 提供）：
 *   - Broadcast：把某個連線的訊息轉發給同房間的其他連線
 *   - Presence ：維護「誰在線」的名單，並在變動時通知全房
 *
 * 使用 WebSocket Hibernation API（ctx.acceptWebSocket），
 * 沒人講話時會自動休眠，不佔用計費時間；連線資料存在 socket 的 attachment 裡，
 * 所以休眠醒來後名單不會不見。
 */

/** 每條連線記在 socket attachment 上的資料 */
interface Attachment {
  clientId: string
  meta: RoomMeta | null
}

/** 前端宣告的自身資訊（對應 PresenceMeta） */
interface RoomMeta {
  isTeacher: boolean
  seatNo?: string
  name?: string
  role?: string
  away?: boolean
  joinedAt: number
}

type ClientMessage =
  | { t: 'join'; meta: RoomMeta }
  | { t: 'msg'; event: string; payload: unknown }

export class Room implements DurableObject {
  private readonly ctx: DurableObjectState

  constructor(ctx: DurableObjectState) {
    this.ctx = ctx
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('expected websocket', { status: 426 })
    }

    const url = new URL(request.url)
    const clientId = (url.searchParams.get('id') ?? '').trim() || crypto.randomUUID()

    const pair = new WebSocketPair()
    const client = pair[0]
    const server = pair[1]

    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ clientId, meta: null } satisfies Attachment)

    return new Response(null, { status: 101, webSocket: client })
  }

  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): void {
    if (typeof raw !== 'string') return

    let msg: ClientMessage
    try {
      msg = JSON.parse(raw) as ClientMessage
    } catch {
      return
    }

    const att = ws.deserializeAttachment() as Attachment | null
    if (!att?.clientId) return

    // 開始參與 / 更新自身狀態
    if (msg.t === 'join') {
      ws.serializeAttachment({ clientId: att.clientId, meta: msg.meta } satisfies Attachment)
      this.broadcastPresence()
      return
    }

    // 轉發事件給同房間的其他人（不 echo 給自己，與原本行為一致）
    if (msg.t === 'msg') {
      if (typeof msg.event !== 'string' || msg.event.startsWith('__')) return
      const out = JSON.stringify({
        t: 'msg',
        from: att.clientId,
        event: msg.event,
        payload: msg.payload,
      })
      for (const other of this.liveSockets()) {
        if (other === ws) continue
        try {
          other.send(out)
        } catch {
          /* 對方已斷線 */
        }
      }
    }
  }

  webSocketClose(ws: WebSocket): void {
    this.broadcastPresence()
  }

  webSocketError(ws: WebSocket): void {
    try {
      ws.close()
    } catch {
      /* 已經關了 */
    }
    this.broadcastPresence()
  }

  /**
   * 目前還開著的連線。
   * 在 webSocketClose 執行的當下，剛關閉的那條連線仍可能出現在 getWebSockets()，
   * 所以要自己檢查 readyState，否則名單會殘留已離線的人。
   */
  private liveSockets(): WebSocket[] {
    return this.ctx.getWebSockets().filter((ws) => ws.readyState === 1 /* OPEN */)
  }

  /** 把目前房間內的名單送給所有人 */
  private broadcastPresence(): void {
    const now = Date.now()
    const sockets = this.liveSockets()

    const members = []
    for (const ws of sockets) {
      const att = ws.deserializeAttachment() as Attachment | null
      if (!att?.clientId || !att.meta) continue
      members.push({ clientId: att.clientId, ...att.meta, lastSeen: now })
    }
    members.sort((a, b) => a.joinedAt - b.joinedAt)

    const out = JSON.stringify({ t: 'presence', members })
    for (const ws of sockets) {
      try {
        ws.send(out)
      } catch {
        /* 對方已斷線 */
      }
    }
  }
}
