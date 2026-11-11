/**
 * 環境變數集中管理
 */

const env = import.meta.env

/**
 * 正規化 Supabase 網址：
 * 後台有兩個容易混淆的網址 ——「Project URL」與「Data API URL」。
 * 後者結尾會多一段 `/rest/v1/`，即時連線（Realtime）不能用，
 * 這裡自動去掉，避免貼錯就整班連不上。
 */
function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '')
    .replace(/\/+$/, '')
}

export const SUPABASE_URL = normalizeSupabaseUrl(env.VITE_SUPABASE_URL ?? '')
export const SUPABASE_ANON_KEY = (env.VITE_SUPABASE_ANON_KEY ?? '').trim()

export const isSupabaseConfigured = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''

/** 對外網址（未設定時用瀏覽器目前的網址） */
export const PUBLIC_URL = (env.VITE_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')

export type RealtimeMode = 'auto' | 'mock' | 'supabase'

export const REALTIME_MODE: RealtimeMode =
  ((env.VITE_REALTIME_MODE ?? 'auto').trim() as RealtimeMode) || 'auto'

/** 決定實際要使用的即時通訊模式 */
export function resolveRealtimeMode(): 'mock' | 'supabase' {
  if (REALTIME_MODE === 'mock') return 'mock'
  if (REALTIME_MODE === 'supabase') {
    if (!isSupabaseConfigured) {
      console.warn('[env] VITE_REALTIME_MODE=supabase 但未設定 Supabase 環境變數，改用 mock 模式。')
      return 'mock'
    }
    return 'supabase'
  }
  return isSupabaseConfigured ? 'supabase' : 'mock'
}
