/**
 * 學生加入網址的計算
 */

import { PUBLIC_URL } from '@/lib/env'

export interface JoinUrlInfo {
  url: string
  /** 網址是否只在本機可用（學生手機連不到） */
  isLocalOnly: boolean
}

export function getJoinUrl(roomCode: string): JoinUrlInfo {
  const base = PUBLIC_URL || window.location.origin
  const url = `${base.replace(/\/+$/, '')}/join/${roomCode}`
  const host = (() => {
    try {
      return new URL(base).hostname
    } catch {
      return base
    }
  })()
  const isLocalOnly = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)$/.test(host)
  return { url, isLocalOnly }
}
