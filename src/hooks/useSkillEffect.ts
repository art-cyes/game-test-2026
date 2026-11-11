import { useEffect, useState } from 'react'
import type { SkillFxKind } from '@/components/SkillEffect'

export interface SkillTrigger {
  /** 事件種類（skill-defense / skill-ult / boss-ult） */
  kind: string
  /** 每次觸發都要不一樣的值（用事件 id 或時間戳） */
  id: number
}

function toFxKind(kind: string): SkillFxKind | null {
  if (kind === 'skill-defense') return 'shield'
  if (kind === 'skill-ult') return 'ult'
  if (kind === 'boss-ult') return 'bossUlt'
  return null
}

/** 依觸發事件播放對應的技能特效，時間到自動消失 */
export function useSkillEffect(trigger: SkillTrigger | null, durationMs = 1300): SkillFxKind | null {
  const [fx, setFx] = useState<SkillFxKind | null>(null)
  const key = trigger ? `${trigger.kind}:${trigger.id}` : null

  useEffect(() => {
    if (!trigger) return
    const kind = toFxKind(trigger.kind)
    if (!kind) return
    setFx(kind)
    const t = setTimeout(() => setFx(null), durationMs)
    return () => clearTimeout(t)
    // key 已包含 kind 與 id，兩者任一改變都要重播
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, durationMs])

  return fx
}

/**
 * 短暫切換某個狀態：觸發時變成 value，時間到變回 fallback。
 * 用來播放角色的攻擊／受擊等動畫。
 */
export function useTransientState<T>(
  trigger: { id: number } | null,
  value: T,
  fallback: T,
  durationMs: number,
): T {
  const [state, setState] = useState<T>(fallback)
  const key = trigger?.id ?? null

  useEffect(() => {
    if (key === null) return
    setState(value)
    const t = setTimeout(() => setState(fallback), durationMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, durationMs])

  return state
}
