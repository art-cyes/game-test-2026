/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Worker 入口。
 *
 * 一個 Worker 同時負責兩件事，所以整個遊戲只需要「一個部署」：
 *   1. 靜態網站：public/ 與建置產物 dist/（含 SPA 轉址）
 *   2. 即時連線：/ws → 轉給對應房間的 Durable Object
 *
 * 前端網址與 WebSocket 同一個網域，因此不需要任何環境變數。
 */

import { Room } from './room'

export { Room }

interface Env {
  /** 靜態資源（wrangler.jsonc 的 assets.binding） */
  ASSETS: Fetcher
  /** Durable Object namespace（每個房間一個實例） */
  ROOMS: DurableObjectNamespace
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/ws') {
      const room = (url.searchParams.get('room') ?? '').trim()
      if (!room) return new Response('missing room', { status: 400 })
      const stub = env.ROOMS.get(env.ROOMS.idFromName(room))
      return stub.fetch(request)
    }

    // 其餘交給靜態資源（找不到的路徑會回 index.html，支援 /join/XXXX 這類深層連結）
    return env.ASSETS.fetch(request)
  },
} satisfies ExportedHandler<Env>
