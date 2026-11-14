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

/**
 * Supabase 後台「這個專案」的網址。
 * 從 Project URL 的 subdomain 取出專案 ref（例如 qrfdtklvxofjtrvdjpud）。
 */
export const SUPABASE_DASHBOARD_URL = (() => {
  const ref = SUPABASE_URL.match(/^https?:\/\/([^.]+)\.supabase\.co/i)?.[1]
  return ref ? `https://supabase.com/dashboard/project/${ref}` : 'https://supabase.com/dashboard'
})()

/** 對外網址（未設定時用瀏覽器目前的網址） */
export const PUBLIC_URL = (env.VITE_PUBLIC_URL ?? '').trim().replace(/\/+$/, '')

export type RealtimeMode = 'auto' | 'mock' | 'supabase' | 'cloudflare'

export const REALTIME_MODE: RealtimeMode =
  ((env.VITE_REALTIME_MODE ?? 'auto').trim() as RealtimeMode) || 'auto'

/**
 * Cloudflare Worker 的位址（選填）。
 * 留空 = 用目前網址（部署後前端與 Worker 同一個網域，不需要設定）。
 * 本機想連 `wrangler dev` 時可設成 ws://localhost:8787。
 */
export const REALTIME_URL = (env.VITE_REALTIME_URL ?? '').trim().replace(/\/+$/, '')

export type ResolvedRealtimeMode = 'mock' | 'supabase' | 'cloudflare'

/**
 * 決定實際要使用的即時通訊模式。
 *
 * auto（預設）的判斷順序：
 *   1. 有設定 Supabase → supabase（保留舊部署的相容性）
 *   2. 有設定 VITE_REALTIME_URL → cloudflare
 *   3. 本機（localhost）→ mock，開發最方便
 *   4. 其他（已部署的網域）→ cloudflare
 */
export function resolveRealtimeMode(): ResolvedRealtimeMode {
  if (REALTIME_MODE === 'mock') return 'mock'
  if (REALTIME_MODE === 'cloudflare') return 'cloudflare'

  if (REALTIME_MODE === 'supabase') {
    if (!isSupabaseConfigured) {
      console.warn('[env] VITE_REALTIME_MODE=supabase 但未設定 Supabase 環境變數，改用 mock 模式。')
      return 'mock'
    }
    return 'supabase'
  }

  // auto
  if (isSupabaseConfigured) return 'supabase'
  if (REALTIME_URL) return 'cloudflare'

  const host = typeof location === 'undefined' ? '' : location.hostname
  const isLocal = /^(localhost|127\.|0\.0\.0\.0|\[::1\]|.*\.local)$/i.test(host)
  return isLocal ? 'mock' : 'cloudflare'
}
