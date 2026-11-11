import { useEffect, useState } from 'react'
import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env'

export type SupabaseHealth = 'not-configured' | 'checking' | 'ok' | 'unreachable'

/**
 * 檢查 Supabase 專案是否活著。
 *
 * 免費專案閒置 7 天會被自動暫停，此時 API 會失效、學生連不上。
 * 這裡打一個輕量的健康檢查端點，讓老師上課前就能發現。
 */
export function useSupabaseHealth(): SupabaseHealth {
  const [health, setHealth] = useState<SupabaseHealth>(
    isSupabaseConfigured ? 'checking' : 'not-configured',
  )

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setHealth('not-configured')
      return
    }
    let cancelled = false
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)

    fetch(`${SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: SUPABASE_ANON_KEY },
      signal: controller.signal,
    })
      .then((res) => {
        // 4xx（例如未授權）代表服務有回應；只有 5xx 或連不上才算異常
        if (!cancelled) setHealth(res.status < 500 ? 'ok' : 'unreachable')
      })
      .catch(() => {
        if (!cancelled) setHealth('unreachable')
      })
      .finally(() => clearTimeout(timer))

    return () => {
      cancelled = true
      clearTimeout(timer)
      controller.abort()
    }
  }, [])

  return health
}
