/**
 * 即時通訊轉接層入口
 *
 * 依環境自動選擇實作（見 env.ts 的 resolveRealtimeMode）：
 *   - cloudflare：部署在自己的 Cloudflare Worker（同一個網域 /ws），預設
 *   - supabase  ：有設定 Supabase 環境變數時使用（備援）
 *   - mock      ：本機開發（同一個瀏覽器的多個分頁即可互通）
 */

import { REALTIME_URL, resolveRealtimeMode, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'
import { CloudflareAdapter } from './cloudflareAdapter'
import { MockAdapter } from './mockAdapter'
import { SupabaseAdapter } from './supabaseAdapter'
import type { RealtimeAdapter } from './types'

export function createRealtimeAdapter(): RealtimeAdapter {
  const mode = resolveRealtimeMode()

  if (mode === 'cloudflare') {
    console.info('[realtime] 使用 Cloudflare Worker + Durable Object')
    return new CloudflareAdapter(REALTIME_URL)
  }

  if (mode === 'supabase') {
    console.info('[realtime] 使用 Supabase Realtime')
    return new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY)
  }

  console.info('[realtime] 使用本機 Mock 模式（同瀏覽器多分頁互通）')
  return new MockAdapter()
}

export * from './types'
