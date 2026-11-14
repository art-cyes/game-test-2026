import { useEffect, useState } from 'react'
import {
  isSupabaseConfigured,
  REALTIME_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
  type ResolvedRealtimeMode,
} from '@/lib/env'
import { makeClientId } from '@/lib/realtime/ids'

export type RealtimeHealth = 'not-configured' | 'checking' | 'ok' | 'unreachable'

const TIMEOUT_MS = 10000

/**
 * 檢查即時連線後端是否活著，讓老師上課前就能發現問題。
 *   - cloudflare：對 /ws 做一次 WebSocket 握手
 *   - supabase  ：打健康檢查端點（免費專案閒置會被暫停）
 *   - mock      ：不需要檢查
 */
export function useRealtimeHealth(mode: ResolvedRealtimeMode): RealtimeHealth {
  const [health, setHealth] = useState<RealtimeHealth>(
    mode === 'mock' ? 'not-configured' : 'checking',
  )

  useEffect(() => {
    if (mode === 'mock') {
      setHealth('not-configured')
      return
    }

    let cancelled = false

    /* ---------------- Supabase：HTTP 健康檢查 ---------------- */
    if (mode === 'supabase') {
      if (!isSupabaseConfigured) {
        setHealth('not-configured')
        return
      }
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
      fetch(`${SUPABASE_URL}/auth/v1/health`, {
        headers: { apikey: SUPABASE_ANON_KEY },
        signal: controller.signal,
      })
        // 4xx（例如未授權）代表服務有回應；只有 5xx 或連不上才算異常
        .then((res) => {
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
    }

    /* ---------------- Cloudflare：WebSocket 握手 ---------------- */
    setHealth('checking')
    const base =
      REALTIME_URL ||
      `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}`

    let ws: WebSocket | null = null
    const close = () => {
      try {
        ws?.close()
      } catch {
        /* 已經關了 */
      }
    }
    const timer = setTimeout(() => {
      if (cancelled) return
      setHealth('unreachable')
      close()
    }, TIMEOUT_MS)

    try {
      ws = new WebSocket(`${base}/ws?room=__health&id=${makeClientId()}`)
    } catch {
      clearTimeout(timer)
      setHealth('unreachable')
      return
    }
    ws.onopen = () => {
      if (cancelled) return
      clearTimeout(timer)
      setHealth('ok')
      close()
    }
    ws.onerror = () => {
      if (cancelled) return
      clearTimeout(timer)
      setHealth('unreachable')
    }

    return () => {
      cancelled = true
      clearTimeout(timer)
      close()
    }
  }, [mode])

  return health
}
