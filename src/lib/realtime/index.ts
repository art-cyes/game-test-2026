/**
 * 即時通訊轉接層入口
 *
 * 依環境自動選擇實作：
 *   - 有設定 Supabase → SupabaseAdapter（雲端）
 *   - 沒設定          → MockAdapter（本機多分頁）
 */

import { resolveRealtimeMode, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'
import { MockAdapter } from './mockAdapter'
import { SupabaseAdapter } from './supabaseAdapter'
import type { RealtimeAdapter } from './types'

export function createRealtimeAdapter(): RealtimeAdapter {
  const mode = resolveRealtimeMode()
  if (mode === 'supabase') {
    console.info('[realtime] 使用 Supabase Realtime')
    return new SupabaseAdapter(SUPABASE_URL, SUPABASE_ANON_KEY)
  }
  console.info('[realtime] 使用本機 Mock 模式（同瀏覽器多分頁互通）')
  return new MockAdapter()
}

export * from './types'
