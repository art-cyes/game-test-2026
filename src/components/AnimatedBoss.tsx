import { BOSS_SPRITES } from '@/lib/assets'
import { SpriteActor } from './SpriteActor'
import type { ActorState } from './AnimatedHero'
import type { BossDifficulty } from '@/types'

interface Props {
  difficulty: BossDifficulty
  state?: ActorState | 'down'
  /** 顯示高度（px）；省略時由 className 的 CSS 控制（自適應） */
  size?: number
  className?: string
  title?: string
}

/**
 * 魔王角色（Ninja Adventure 像素 spritesheet）。
 *   idle   → 待機（循環）
 *   attack → 撲擊（單次）
 *   cast   → 施放大招（撲擊 + 紅光）
 *   hurt   → 受擊（單次）
 *   down   → 被擊敗（待機 + 灰暗傾倒）
 */
export function AnimatedBoss({ difficulty, state = 'idle', size, className = '', title }: Props) {
  const set = BOSS_SPRITES[difficulty]
  const once = state === 'attack' || state === 'cast' || state === 'hurt'
  const sheet = state === 'hurt' ? set.hurt : once ? set.attack : set.idle
  const cls = [
    state === 'cast' ? 'sprite-actor--cast' : '',
    state === 'down' ? 'sprite-actor--down' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <SpriteActor
      key={state}
      sheet={sheet}
      once={once}
      height={size}
      className={cls}
      title={title ?? difficulty}
    />
  )
}
